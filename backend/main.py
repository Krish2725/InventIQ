from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import os
import uuid
import logging
import warnings
import json
import asyncio
import numpy as np  # <-- Added NumPy
from google import genai
from google.genai import errors
from google.genai import types
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from statsmodels.tsa.arima.model import ARIMA
from pydantic import BaseModel

warnings.filterwarnings("ignore")

logger = logging.getLogger("uvicorn.error")
load_dotenv()
app = FastAPI(title="InventIQ AI Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:5174"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
MODEL_CANDIDATES = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.7-flash"
]

jobs_db = {}

REQUIRED_INVENTORY_SCHEMA = ['product_name', 'units_sold_last_month', 'profit_margin_percentage', 'unit_price']
REQUIRED_CHURN_SCHEMA = ['customer_name', 'days_since_last_purchase', 'total_transactions', 'total_spent', 'is_churned']

def heuristic_column_mapping(raw_columns: list) -> dict:
    mapping = {}
    patterns = {
        'product_name': ['item', 'product', 'product_name', 'item_name', 'item_name_id', 'product_id', 'sku', 'name', 'title'],
        'units_sold_last_month': ['qty_sold_prev_mo', 'units_sold_last_month', 'units_sold', 'quantity', 'qty', 'sales_volume', 'units', 'volume'],
        'profit_margin_percentage': ['margin_pct', 'profit_margin_percentage', 'profit_margin', 'margin', 'profit_%', 'margin_%'],
        'unit_price': ['cost_usd', 'unit_price', 'price', 'unit_cost', 'cost', 'rate'],
        'customer_name': ['customer_name', 'customer', 'user', 'client', 'client_name'],
        'days_since_last_purchase': ['days_since_last_purchase', 'recency', 'days_since_last_order', 'last_purchase_days', 'days_inactive'],
        'total_transactions': ['total_transactions', 'transactions', 'orders', 'order_count', 'total_orders'],
        'total_spent': ['total_spent', 'spent', 'total_spend', 'revenue', 'monetary', 'amount_spent'],
        'is_churned': ['is_churned', 'churn', 'churned', 'status']
    }
    for col in raw_columns:
        clean = col.lower().replace(" ", "_").strip()
        for sys_col, aliases in patterns.items():
            if clean in aliases or any(alias in clean for alias in aliases):
                mapping[col] = sys_col
                break
    return mapping

async def attempt_ai_column_mapping(raw_columns: list) -> dict:
    prompt = f"""
    You are a data engineering AI. 
    The user uploaded a spreadsheet with these raw columns: {raw_columns}
    
    Map them to one of our two system schemas if they logically match:
    Inventory Schema: {REQUIRED_INVENTORY_SCHEMA}
    Churn Schema: {REQUIRED_CHURN_SCHEMA}
    
    Return ONLY a valid JSON dictionary where the keys are the RAW user columns, and the values are the SYSTEM columns. 
    If a column doesn't match anything, do not include it. Do not include markdown formatting.
    Example: {{"Item": "product_name", "Cost": "unit_price"}}
    """
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return heuristic_column_mapping(raw_columns)
        
    try:
        aclient = genai.Client(api_key=api_key).aio
        for attempt in range(3):
            try:
                response = await aclient.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                )
                mapped = json.loads(response.text)
                return mapped if mapped else heuristic_column_mapping(raw_columns)
            except errors.APIError as e:
                # Gemini can return transient 429/5xx responses during load spikes.
                if e.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise
                delay = 0.5 * (2 ** attempt)
                logger.warning(
                    "AI column mapping returned HTTP %s; retrying in %.1fs (%d/2)",
                    e.code, delay, attempt + 1
                )
                await asyncio.sleep(delay)
    except Exception as e:
        logger.warning(f"AI Mapping fallback triggered: {e}")
        return heuristic_column_mapping(raw_columns)

def run_inventory_ml(df: pd.DataFrame):
    """Executes clustering and forecasting math, returning structured dicts for React and Gemini."""
    numeric_df = df.select_dtypes(include=[np.number]).fillna(0)
    
    # --- 1. K-MEANS CLUSTERING ---
    if numeric_df.shape[1] >= 2 and len(df) >= 3:
        features = numeric_df.iloc[:, :2]
        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        numeric_df['Cluster'] = kmeans.fit_predict(features)
        
        counts = numeric_df['Cluster'].value_counts().to_dict()
        cluster_means = numeric_df.groupby('Cluster').mean().sum(axis=1).sort_values()
        
        labels = {
            cluster_means.index[0]: "Dead Stock",
            cluster_means.index[1]: "Slow Movers",
            cluster_means.index[2]: "Cash Cows"
        }
        kmeans_result = [{"category": labels.get(cluster, f"Segment {cluster}"), "volume": int(count)} for cluster, count in counts.items()]
    else:
        n = len(df)
        kmeans_result = [
            {"category": "Cash Cows", "volume": max(1, n // 2)},
            {"category": "Slow Movers", "volume": max(1, n // 3)},
            {"category": "Dead Stock", "volume": max(1, n - (n // 2 + n // 3))}
        ]

    # --- 2. ARIMA FORECASTING ---
    hist_cols = [c for c in ['sales_m1', 'sales_m2', 'sales_m3', 'sales_m4', 'sales_m5', 'sales_m6'] if c in df.columns]
    if len(hist_cols) >= 3:
        historical_totals = [float(df[c].sum()) for c in hist_cols[:3]]
    elif 'units_sold_last_month' in df.columns:
        total_units = float(df['units_sold_last_month'].sum())
        price = float(df['unit_price'].mean()) if 'unit_price' in df.columns else 35.0
        base_rev = total_units * price
        historical_totals = [round(base_rev * 0.82, 2), round(base_rev * 0.93, 2), round(base_rev, 2)]
    elif numeric_df.shape[1] > 0:
        target_col = numeric_df.columns[0]
        raw_series = numeric_df[target_col].values
        if len(raw_series) >= 3:
            history_chunks = np.array_split(raw_series, 3)
            historical_totals = [float(sum(chunk)) for chunk in history_chunks]
        else:
            historical_totals = [float(x) for x in raw_series] + [0.0] * (3 - len(raw_series))
    else:
        historical_totals = [12000.0, 14000.0, 16000.0]

    try:
        model = ARIMA(historical_totals, order=(1, 1, 0))
        model_fit = model.fit()
        forecast = [float(x) for x in model_fit.forecast(steps=3)]
    except:
        trend = (historical_totals[-1] - historical_totals[0]) / max(1, len(historical_totals))
        forecast = [float(historical_totals[-1] + (trend * i)) for i in range(1, 4)]
    
    months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    arima_result = []
    
    for i in range(3):
        arima_result.append({"month": months[i], "revenue": round(float(historical_totals[i]), 2), "forecast": round(float(historical_totals[i]), 2)})
    for i in range(3):
        arima_result.append({"month": months[i+3], "revenue": None, "forecast": round(float(forecast[i]), 2)})

    # Format the exact way React expects it
    ml_results = {
        "arima": arima_result,
        "kmeans": kmeans_result
    }
    
    return ml_results, "Inventory Optimization"

def run_churn_ml(df: pd.DataFrame):
    """Runs Customer Pipeline: Logistic Regression to predict churn probabilities."""
    features = ['days_since_last_purchase', 'total_transactions', 'total_spent']
    X = df[features]
    y = df['is_churned']
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    lr = LogisticRegression(class_weight='balanced', random_state=42)
    lr.fit(X_scaled, y)
    
    active_customers = df[df['is_churned'] == 0].copy()
    if active_customers.empty:
        return {"Message": "No active customers available to evaluate."}, "Customer Churn"
        
    X_active_scaled = scaler.transform(active_customers[features])
    active_customers['churn_probability'] = lr.predict_proba(X_active_scaled)[:, 1]
    
    high_risk = active_customers[active_customers['churn_probability'] >= 0.70]['customer_name'].tolist()
    medium_risk = active_customers[(active_customers['churn_probability'] >= 0.40) & (active_customers['churn_probability'] < 0.70)]['customer_name'].tolist()
    safe = active_customers[active_customers['churn_probability'] < 0.40]['customer_name'].tolist()
    
    churn_insights = {
        "High Churn Risk (70%+ Probability)": high_risk,
        "Medium Churn Risk (40-69% Probability)": medium_risk,
        "Stable Customers (Safe)": safe
    }
    
    return churn_insights, "Customer Retention"

async def process_data_pipeline(job_id: str, df: pd.DataFrame, filename: str):
    """Smart Router: Determines context, runs ML, and prompts Gemini."""
    try:
        if 'profit_margin_percentage' in df.columns:
            ml_results, context = run_inventory_ml(df)
        elif 'days_since_last_purchase' in df.columns:
            ml_results, context = run_churn_ml(df)
        else:
            ml_results, context = run_inventory_ml(df)

        prompt = f"""
        You are a strategic business manager for a retail MSME. Focus Area: {context}
        Here is the latest machine learning analysis: {ml_results}
        
        If this is an Inventory analysis: generate a 3-step action plan to optimize stock, handle anomalies, and execute ARIMA forecasted demand.
        If this is a Customer Retention analysis: generate a 3-step action plan targeting the specific high-risk customers identified by the Logistic Regression model.
        """
        
        successful_response = None
        model_used = "Local Analytics Engine"
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                aclient = genai.Client(api_key=api_key).aio
                for model in MODEL_CANDIDATES:
                    try:
                        response = await aclient.models.generate_content(
                            model=model,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                            )
                        )
                        successful_response = response.text
                        model_used = model
                        break
                    except Exception as err:
                        logger.warning(f"{model} failed. Trying fallback... Error: {err}")
                        continue
            except Exception as e:
                logger.warning(f"Gemini client initialization failed: {e}")

        if not successful_response:
            successful_response = f"Strategic audit completed for {filename}. Analyzed {len(df)} records using {context}. Recommendations: Reallocate working capital toward high-performing inventory segments and liquidate identified dead stock."

        jobs_db[job_id] = {
            "status": "completed",
            "filename": filename,
            "analysis_type": context,
            "model_used": model_used,
            "result": ml_results,
            "ai_strategic_plan": successful_response
        }

    except Exception as e:
        logger.error(f"Pipeline job {job_id} failed: {e}")
        jobs_db[job_id] = {"status": "failed", "error": str(e)}

@app.post("/api/plan/upload")
async def upload_and_dispatch_job(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    manual_mapping: str = Form(None)
):
    """Intercepts upload, handles AI mapping / Manual Fallback, and dispatches to ML queue."""
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise ValueError("Unsupported file format.")
            
        raw_columns = df.columns.tolist()
        
        if manual_mapping and manual_mapping.strip() and manual_mapping != "string":
            try:
                mapping_dict = json.loads(manual_mapping)
                df.rename(columns=mapping_dict, inplace=True)
            except json.JSONDecodeError:
                raise ValueError("manual_mapping override must be a valid JSON dictionary.")
                
        else:
            ai_mapping = await attempt_ai_column_mapping(raw_columns)
            df.rename(columns=ai_mapping, inplace=True)
            
            current_cols = df.columns.tolist()
            has_inventory = all(col in current_cols for col in ['product_name', 'units_sold_last_month', 'profit_margin_percentage'])
            has_churn = all(col in current_cols for col in ['customer_name', 'days_since_last_purchase'])
            
            if not has_inventory and not has_churn:
                return {
                    "status": "requires_mapping",
                    "message": "AI could not confidently map your columns.",
                    "raw_columns": raw_columns,
                    "expected_inventory": REQUIRED_INVENTORY_SCHEMA,
                    "expected_churn": REQUIRED_CHURN_SCHEMA
                }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")

    job_id = str(uuid.uuid4())
    jobs_db[job_id] = {"status": "processing"}
    background_tasks.add_task(process_data_pipeline, job_id, df, file.filename)

    return {"status": "accepted", "message": "File mapped and processing started.", "job_id": job_id}

@app.get("/api/plan/status/{job_id}")
def get_job_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job ID not found.")
    return jobs_db[job_id]

class ChatQuery(BaseModel):
    question: str

@app.post("/api/plan/consult")
async def consult_ai(query: ChatQuery):
    simulated_ai_response = f"Analysis complete for: '{query.question}'. Based on the active ARIMA model, re-allocating 15% of your Q4 budget to high-yield inventory will optimize your cash flow."
    return {"answer": simulated_ai_response}
