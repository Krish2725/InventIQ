from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
import pandas as pd
import io
import os
import uuid
import logging
import warnings
import json
from google import genai
from google.genai import errors
from google.genai import types
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from statsmodels.tsa.arima.model import ARIMA

warnings.filterwarnings("ignore")
logger = logging.getLogger("uvicorn.error")
load_dotenv()
app = FastAPI(title="InventIQ AI Backend")

MODEL_CANDIDATES = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.7-flash"
]

jobs_db = {}

REQUIRED_INVENTORY_SCHEMA = ['product_name', 'units_sold_last_month', 'profit_margin_percentage', 'unit_price']
REQUIRED_CHURN_SCHEMA = ['customer_name', 'days_since_last_purchase', 'total_transactions', 'total_spent', 'is_churned']

async def attempt_ai_column_mapping(raw_columns: list) -> dict:
    """Uses Gemini to attempt to map messy user columns to our strict system schemas."""
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
    
    api_key = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
    aclient = genai.Client(api_key=api_key).aio
    
    try:
        response = await aclient.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"AI Mapping failed: {e}")
        return {} 

def run_inventory_ml(df: pd.DataFrame):
    """Runs Inventory Pipeline: K-Means, Isolation Forest, and ARIMA with Financials."""
    features = ['units_sold_last_month', 'profit_margin_percentage']
    X = df[features]
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    
    iso_forest = IsolationForest(contamination=0.1, random_state=42)
    df['anomaly_score'] = iso_forest.fit_predict(X_scaled)
    anomalies = df[df['anomaly_score'] == -1]['product_name'].tolist()
    

    n_clusters = min(3, len(df))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df['cluster'] = kmeans.fit_predict(X_scaled)
    cluster_summaries = df.groupby('cluster')[features].mean()
    
    cluster_labels = {}
    for cluster_id in range(n_clusters):
        avg_sales = cluster_summaries.loc[cluster_id, 'units_sold_last_month']
        avg_profit = cluster_summaries.loc[cluster_id, 'profit_margin_percentage']
        if avg_sales > 200:
            cluster_labels[cluster_id] = "High Volume Movers (Cash Cows)"
        elif avg_profit > 40:
            cluster_labels[cluster_id] = "High Margin, Low Volume (Niche/Premium)"
        else:
            cluster_labels[cluster_id] = "Slow Movers (Needs Attention)"
            
    df['category_label'] = df['cluster'].map(cluster_labels)
    
    inventory_insights = {"Statistical Anomalies (Investigate Outliers)": anomalies}
    for label in set(cluster_labels.values()):
        inventory_insights[label] = df[df['category_label'] == label]['product_name'].tolist()
        
    
    historical_cols = ['sales_m1', 'sales_m2', 'sales_m3', 'sales_m4', 'sales_m5', 'sales_m6']
    if all(col in df.columns for col in historical_cols):
        forecast_results = []
        for index, row in df.iterrows():
            try:
                history = row[historical_cols].values.astype(float)
                model = ARIMA(history, order=(1, 1, 0))
                forecast_units = max(0, int(model.fit().forecast(steps=1)[0]))
                
                product_data = {
                    "product": row['product_name'],
                    "forecasted_units": forecast_units
                }
                
                if 'unit_price' in df.columns:
                    price = float(row['unit_price'])
                    projected_revenue = forecast_units * price
                    arr = projected_revenue * 12 
                    product_data["projected_revenue"] = projected_revenue
                    product_data["annual_run_rate"] = arr
                    
                forecast_results.append(product_data)
            except Exception:
                forecast_results.append({
                    "product": row['product_name'],
                    "error": "Forecast mathematically unavailable"
                })
        inventory_insights["Financial_Projections"] = forecast_results

    return inventory_insights, "Inventory Optimization"

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
            raise ValueError("CSV schema not recognized after mapping.")

        prompt = f"""
        You are a strategic business manager for a retail MSME. Focus Area: {context}
        Here is the latest machine learning analysis: {ml_results}
        
        If this is an Inventory analysis: generate a 3-step action plan to optimize stock, handle anomalies, and execute ARIMA forecasted demand.
        If this is a Customer Retention analysis: generate a 3-step action plan targeting the specific high-risk customers identified by the Logistic Regression model.
        """

        
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is missing from the environment.")
    
        aclient = genai.Client(api_key=api_key).aio
       
        last_error = successful_response = model_used = None

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
                last_error = err
                continue

        if successful_response is None:
            jobs_db[job_id] = {"status": "failed", "error": str(last_error)}
            return

        jobs_db[job_id] = {
            "status": "completed",
            "filename": filename,
            "analysis_type": context,
            "model_used": model_used,
            "data_insights": ml_results,
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
