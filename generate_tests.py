import pandas as pd

# 1. Perfect Inventory File (Now with Prices to test Financials)
pd.DataFrame({
    "product_name": ["Cotton T-Shirt", "Winter Jacket", "Sneakers"],
    "units_sold_last_month": [450, 30, 15],
    "profit_margin_percentage": [15, 65, 20],
    "unit_price": [20.00, 150.00, 80.00],
    "sales_m1": [400, 120, 80], "sales_m2": [410, 90, 75], 
    "sales_m3": [415, 70, 50], "sales_m4": [430, 50, 40], 
    "sales_m5": [440, 40, 20], "sales_m6": [450, 30, 15]
}).to_excel("test_perfect_inventory.xlsx", index=False)

# 2. Messy Data File (To test the AI Auto-Mapper)
pd.DataFrame({
    "Item_Name_ID": ["Summer Hat", "Wool Scarf"],
    "Qty_Sold_Prev_Mo": [100, 50],
    "Margin_Pct": [20, 30],
    "Cost_USD": [15.00, 25.00]
}).to_excel("test_messy_data.xlsx", index=False)

print("Test files generated successfully!")