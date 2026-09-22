import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

def analyze_retail_inventory(csv_file_path):
    """
    Reads retail data and uses K-Means clustering to segment products.
    Returns a dictionary of the insights.
    """
    print("Loading data...")
    # 1. Load the data using Pandas
    df = pd.read_csv(csv_file_path)
    
    # 2. Select the features we want the AI to analyze
    features = ['units_sold_last_month', 'profit_margin_percentage']
    X = df[features]
    
    # 3. Scale the data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print("Running Scikit-learn K-Means Clustering...")
    # 4. Initialize and run K-Means
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    df['cluster'] = kmeans.fit_predict(X_scaled)
    
    # 5. Make sense of the clusters
    cluster_summaries = df.groupby('cluster')[features].mean()
    
    cluster_labels = {}
    for cluster_id in range(3):
        avg_sales = cluster_summaries.loc[cluster_id, 'units_sold_last_month']
        avg_profit = cluster_summaries.loc[cluster_id, 'profit_margin_percentage']
        
        if avg_sales > 200:
            cluster_labels[cluster_id] = "High Volume Movers (Cash Cows)"
        elif avg_profit > 40:
            cluster_labels[cluster_id] = "High Margin, Low Volume (Niche/Premium)"
        else:
            cluster_labels[cluster_id] = "Slow Movers (Needs Attention)"
            
    df['category_label'] = df['cluster'].map(cluster_labels)
    
    # 6. Format the output for the API instead of printing to terminal
    inventory_insights = {}
    
    # Group unique labels and add products to them
    for label in set(cluster_labels.values()):
        products_in_cluster = df[df['category_label'] == label]['product_name'].tolist()
        inventory_insights[label] = products_in_cluster
        
    return inventory_insights

if __name__ == "__main__":
    # Test the function to see the new dictionary format in the terminal
    print(analyze_retail_inventory('mock_retail_data.csv'))