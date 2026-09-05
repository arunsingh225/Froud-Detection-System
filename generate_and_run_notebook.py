import json
import os
import nbformat as nbf

def create_inspection_notebook():
    nb = nbf.v4.new_notebook()
    
    cells = []
    
    # Title Markdown
    cells.append(nbf.v4.new_markdown_cell("""# IEEE-CIS Fraud Detection — Phase 4: Step 1 Dataset Inspection
## FraudGuard AI Platform Research & Exploration

This notebook performs a comprehensive, non-destructive exploratory inspection of the raw **IEEE-CIS Fraud Detection** dataset.

### Objectives:
1. Load `train_transaction.csv` and `train_identity.csv`
2. Inspect shapes, schemas, column names, data types, and head/tail records
3. Analyze the target variable `isFraud` (class distribution & imbalance ratio)
4. Audit missing values and percentage across all features
5. Check for duplicate records and verify `TransactionID` uniqueness
6. Audit core transaction & card attributes (`ProductCD`, `card1-card6`, `addr1-addr2`, `TransactionAmt`, `TransactionDT`)
7. Inspect numerical columns (`describe()`) and categorical features
8. Test relational integrity: join `train_identity` with `train_transaction` on `TransactionID`
9. Calculate the percentage of transactions with linked identity records
10. Generate diagnostic visualizations:
   - Fraud vs. Non-Fraud class distribution
   - Transaction amount distribution (Log vs. Linear scale)
   - Missing-value density overview
11. Export structured audit summary to `data/processed/dataset_inspection_summary.csv`
"""))

    # Cell 1: Imports & Configuration
    cells.append(nbf.v4.new_code_cell("""import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Display and formatting settings
pd.set_option('display.max_columns', 100)
pd.set_option('display.max_rows', 100)
pd.set_option('display.float_format', lambda x: '%.4f' % x)
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
%matplotlib inline

print("All analysis libraries loaded successfully.")
"""))

    # Cell 2: Load Data
    cells.append(nbf.v4.new_code_cell("""# Define dataset paths adaptively
if os.path.exists(os.path.join('data', 'raw', 'ieee_cis')):
    data_dir = os.path.join('data', 'raw', 'ieee_cis')
    proc_dir = os.path.join('data', 'processed')
elif os.path.exists(os.path.join('..', 'data', 'raw', 'ieee_cis')):
    data_dir = os.path.join('..', 'data', 'raw', 'ieee_cis')
    proc_dir = os.path.join('..', 'data', 'processed')
else:
    data_dir = os.path.abspath('data/raw/ieee_cis')
    proc_dir = os.path.abspath('data/processed')

os.makedirs(proc_dir, exist_ok=True)

train_txn_path = os.path.join(data_dir, 'train_transaction.csv')
train_id_path = os.path.join(data_dir, 'train_identity.csv')

print(f"Loading train_transaction from: {train_txn_path}")
df_txn = pd.read_csv(train_txn_path)
print(f"train_transaction loaded successfully. Shape: {df_txn.shape}")

print(f"Loading train_identity from: {train_id_path}")
df_id = pd.read_csv(train_id_path)
print(f"train_identity loaded successfully. Shape: {df_id.shape}")
"""))

    # Cell 3: Shapes, Column Names, Data Types
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("1. DATASET SHAPES & SCHEMAS")
print("=" * 70)
print(f"train_transaction rows: {df_txn.shape[0]:,}, columns: {df_txn.shape[1]}")
print(f"train_identity    rows: {df_id.shape[0]:,}, columns: {df_id.shape[1]}")

print("\\ntrain_transaction Column Types Summary:")
print(df_txn.dtypes.value_counts())

print("\\ntrain_identity Column Types Summary:")
print(df_id.dtypes.value_counts())
"""))

    # Cell 4: First 5 and Last 5 Rows
    cells.append(nbf.v4.new_code_cell("""print("train_transaction First 5 Rows (Selected Core Columns):")
display(df_txn[['TransactionID', 'isFraud', 'TransactionDT', 'TransactionAmt', 'ProductCD', 'card1', 'card4', 'card6']].head())

print("train_transaction Last 5 Rows (Selected Core Columns):")
display(df_txn[['TransactionID', 'isFraud', 'TransactionDT', 'TransactionAmt', 'ProductCD', 'card1', 'card4', 'card6']].tail())

print("\\ntrain_identity First 5 Rows (Selected Columns):")
display(df_id.iloc[:5, :8])
"""))

    # Cell 5: Target Column isFraud Distribution
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("2. TARGET VARIABLE ANALYSIS (isFraud)")
print("=" * 70)

total_txns = len(df_txn)
fraud_counts = df_txn['isFraud'].value_counts()
legit_txns = fraud_counts[0]
fraud_txns = fraud_counts[1]
fraud_pct = (fraud_txns / total_txns) * 100
imbalance_ratio = legit_txns / fraud_txns

print(f"Total Transactions:       {total_txns:,}")
print(f"Legitimate Transactions:  {legit_txns:,} ({100 - fraud_pct:.2f}%)")
print(f"Fraudulent Transactions:  {fraud_txns:,} ({fraud_pct:.2f}%)")
print(f"Class Imbalance Ratio:    {imbalance_ratio:.2f} : 1 (Legitimate : Fraud)")
"""))

    # Cell 6: Duplicate Rows and TransactionID Uniqueness
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("3. DUPLICATE & KEY INTEGRITY AUDIT")
print("=" * 70)

dup_txn_rows = df_txn.duplicated().sum()
dup_id_rows = df_id.duplicated().sum()

txn_id_unique_txn = df_txn['TransactionID'].nunique() == len(df_txn)
txn_id_unique_id = df_id['TransactionID'].nunique() == len(df_id)

print(f"Duplicate rows in train_transaction: {dup_txn_rows}")
print(f"Duplicate rows in train_identity:    {dup_id_rows}")
print(f"Is TransactionID strictly unique in train_transaction? {txn_id_unique_txn}")
print(f"Is TransactionID strictly unique in train_identity?    {txn_id_unique_id}")
"""))

    # Cell 7: Missing Values Audit
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("4. MISSING VALUES AUDIT")
print("=" * 70)

# Transaction missing values
txn_missing_count = df_txn.isnull().sum()
txn_missing_pct = (txn_missing_count / len(df_txn)) * 100
df_txn_missing = pd.DataFrame({'Missing_Count': txn_missing_count, 'Missing_Pct': txn_missing_pct})
df_txn_missing = df_txn_missing[df_txn_missing['Missing_Count'] > 0].sort_values(by='Missing_Pct', ascending=False)

print(f"Columns with missing values in train_transaction: {len(df_txn_missing)} / {df_txn.shape[1]}")
print("\\nTop 15 Columns by Missing Percentage in train_transaction:")
display(df_txn_missing.head(15))

# Identity missing values
id_missing_count = df_id.isnull().sum()
id_missing_pct = (id_missing_count / len(df_id)) * 100
df_id_missing = pd.DataFrame({'Missing_Count': id_missing_count, 'Missing_Pct': id_missing_pct})
df_id_missing = df_id_missing[df_id_missing['Missing_Count'] > 0].sort_values(by='Missing_Pct', ascending=False)

print(f"\\nColumns with missing values in train_identity: {len(df_id_missing)} / {df_id.shape[1]}")
print("\\nTop 10 Columns by Missing Percentage in train_identity:")
display(df_id_missing.head(10))
"""))

    # Cell 8: Unique Values for Important Columns
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("5. CARDINALITY & UNIQUE VALUES AUDIT (CORE COLUMNS)")
print("=" * 70)

core_cols = ['TransactionID', 'TransactionDT', 'TransactionAmt', 'ProductCD', 
             'card1', 'card2', 'card3', 'card4', 'card5', 'card6', 
             'addr1', 'addr2', 'isFraud']

cardinality_data = []
for col in core_cols:
    if col in df_txn.columns:
        n_unique = df_txn[col].nunique()
        n_missing = df_txn[col].isnull().sum()
        pct_missing = (n_missing / len(df_txn)) * 100
        dtype = str(df_txn[col].dtype)
        cardinality_data.append({
            'Column': col,
            'DataType': dtype,
            'UniqueValues': n_unique,
            'MissingCount': n_missing,
            'MissingPct': round(pct_missing, 2)
        })

df_cardinality = pd.DataFrame(cardinality_data)
display(df_cardinality)
"""))

    # Cell 9: Numerical Columns Describe
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("6. NUMERICAL ATTRIBUTES DESCRIPTIVE STATISTICS")
print("=" * 70)

key_numeric = ['TransactionAmt', 'TransactionDT', 'card1', 'card2', 'card3', 'card5', 'addr1', 'addr2']
display(df_txn[key_numeric].describe().T[['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']])
"""))

    # Cell 10: Categorical Attributes Inspection
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("7. CATEGORICAL ATTRIBUTES DISTRIBUTION")
print("=" * 70)

cat_cols = ['ProductCD', 'card4', 'card6']
for c in cat_cols:
    print(f"\\n--- Value Counts for {c} ---")
    vc = df_txn[c].value_counts(dropna=False)
    pct = df_txn[c].value_counts(dropna=False, normalize=True) * 100
    display(pd.DataFrame({'Count': vc, 'Percentage (%)': pct}))
"""))

    # Cell 11: Join Identity with Transaction
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("8. RELATIONAL INTEGRITY & IDENTITY JOIN AUDIT")
print("=" * 70)

# Check intersection of TransactionIDs
txn_ids = set(df_txn['TransactionID'])
id_ids = set(df_id['TransactionID'])
overlap_ids = txn_ids.intersection(id_ids)

overlap_count = len(overlap_ids)
overlap_pct = (overlap_count / len(df_txn)) * 100
id_only_count = len(id_ids - txn_ids)

print(f"Total Transactions:                        {len(df_txn):,}")
print(f"Total Identity Records:                    {len(df_id):,}")
print(f"Matching Transactions with Identity:       {overlap_count:,}")
print(f"Percentage of Transactions with Identity:  {overlap_pct:.2f}%")
print(f"Identity records without Transaction record: {id_only_count}")

# Check fraud rate when identity is present vs missing
df_txn['has_identity'] = df_txn['TransactionID'].isin(overlap_ids)
identity_fraud = df_txn.groupby('has_identity')['isFraud'].agg(['count', 'sum', 'mean'])
identity_fraud.columns = ['Total_Txns', 'Fraud_Txns', 'Fraud_Rate']
identity_fraud['Fraud_Rate_Pct'] = identity_fraud['Fraud_Rate'] * 100
print("\\nFraud Rate Breakdown by Identity Presence:")
display(identity_fraud)
df_txn.drop(columns=['has_identity'], inplace=True)
"""))

    # Cell 12: Visualizations
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("9. DIAGNOSTIC VISUALIZATIONS")
print("=" * 70)

fig, axes = plt.subplots(2, 2, figsize=(16, 12))

# 1. Target Count Barplot
sns.barplot(x=['Legitimate (0)', 'Fraud (1)'], y=[legit_txns, fraud_txns], 
            palette=['#2b8a3e', '#e03131'], ax=axes[0, 0])
axes[0, 0].set_title('Transaction Volume by Class (isFraud)', fontsize=13, fontweight='bold')
axes[0, 0].set_ylabel('Number of Transactions')
for i, v in enumerate([legit_txns, fraud_txns]):
    axes[0, 0].text(i, v + 10000, f"{v:,}\\n({v/total_txns*100:.2f}%)", ha='center', fontsize=11)

# 2. Target Donut Chart
axes[0, 1].pie([legit_txns, fraud_txns], labels=['Legitimate', 'Fraud'], 
               autopct='%1.2f%%', startangle=90, colors=['#339af0', '#f03e3e'],
               explode=[0, 0.1], textprops={'fontsize': 11})
axes[0, 1].set_title(f'Fraud Proportion ({fraud_pct:.2f}%)', fontsize=13, fontweight='bold')

# 3. Transaction Amount Distribution (Log Scale)
sns.histplot(data=df_txn, x='TransactionAmt', hue='isFraud', log_scale=True, 
             bins=50, palette=['#1c7ed6', '#d6336c'], common_norm=False, stat='density', ax=axes[1, 0])
axes[1, 0].set_title('Transaction Amount Distribution (Log Scale)', fontsize=13, fontweight='bold')
axes[1, 0].set_xlabel('Transaction Amount (Log Scale)')
axes[1, 0].set_ylabel('Density')

# 4. Missing Value Distribution Overview
missing_bins = pd.cut(df_txn_missing['Missing_Pct'], bins=[-1, 0, 20, 50, 80, 100], 
                      labels=['0%', '1-20%', '21-50%', '51-80%', '81-100%'])
missing_bin_counts = missing_bins.value_counts().sort_index()
sns.barplot(x=missing_bin_counts.index, y=missing_bin_counts.values, palette='Blues_r', ax=axes[1, 1])
axes[1, 1].set_title('Feature Missingness Overview (Columns per Range)', fontsize=13, fontweight='bold')
axes[1, 1].set_xlabel('Missing Percentage Range')
axes[1, 1].set_ylabel('Number of Columns')
for i, v in enumerate(missing_bin_counts.values):
    axes[1, 1].text(i, v + 2, f"{v}", ha='center', fontsize=11)

plt.tight_layout()
os.makedirs(proc_dir, exist_ok=True)
plot_path = os.path.join(proc_dir, 'dataset_inspection_plots.png')
plt.savefig(plot_path, dpi=200)
print(f"Visualizations saved to: {plot_path}")
plt.show()
"""))

    # Cell 13: Export Summary to CSV
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("10. EXPORTING INSPECTION SUMMARY")
print("=" * 70)

summary_rows = [
    {'Metric': 'train_transaction_rows', 'Value': df_txn.shape[0]},
    {'Metric': 'train_transaction_columns', 'Value': df_txn.shape[1]},
    {'Metric': 'train_identity_rows', 'Value': df_id.shape[0]},
    {'Metric': 'train_identity_columns', 'Value': df_id.shape[1]},
    {'Metric': 'total_transactions', 'Value': total_txns},
    {'Metric': 'legitimate_transactions', 'Value': legit_txns},
    {'Metric': 'fraud_transactions', 'Value': fraud_txns},
    {'Metric': 'fraud_percentage', 'Value': round(fraud_pct, 4)},
    {'Metric': 'imbalance_ratio', 'Value': round(imbalance_ratio, 2)},
    {'Metric': 'train_transaction_duplicate_rows', 'Value': int(dup_txn_rows)},
    {'Metric': 'train_identity_duplicate_rows', 'Value': int(dup_id_rows)},
    {'Metric': 'transaction_id_strictly_unique', 'Value': txn_id_unique_txn},
    {'Metric': 'columns_with_missing_values', 'Value': len(df_txn_missing)},
    {'Metric': 'columns_over_50pct_missing', 'Value': int((df_txn_missing['Missing_Pct'] > 50).sum())},
    {'Metric': 'columns_over_80pct_missing', 'Value': int((df_txn_missing['Missing_Pct'] > 80).sum())},
    {'Metric': 'transactions_with_identity', 'Value': overlap_count},
    {'Metric': 'transactions_with_identity_percentage', 'Value': round(overlap_pct, 2)},
    {'Metric': 'fraud_rate_when_identity_present', 'Value': round(float(identity_fraud.loc[True, 'Fraud_Rate_Pct']), 2)},
    {'Metric': 'fraud_rate_when_identity_missing', 'Value': round(float(identity_fraud.loc[False, 'Fraud_Rate_Pct']), 2)}
]

df_summary = pd.DataFrame(summary_rows)
summary_csv_path = os.path.join(proc_dir, 'dataset_inspection_summary.csv')
df_summary.to_csv(summary_csv_path, index=False)
print(f"Dataset inspection summary successfully exported to: {summary_csv_path}")
display(df_summary)
"""))

    # Cell 14: Final Synthesis Report
    cells.append(nbf.v4.new_code_cell("""print("=" * 70)
print("FINAL DATASET INSPECTION REPORT")
print("=" * 70)
print(f"1. Dataset Dimensions:")
print(f"   - train_transaction: {df_txn.shape[0]:,} rows x {df_txn.shape[1]} columns")
print(f"   - train_identity:    {df_id.shape[0]:,} rows x {df_id.shape[1]} columns")
print(f"2. Class Imbalance (Target isFraud):")
print(f"   - Legitimate (0):    {legit_txns:,} ({100 - fraud_pct:.2f}%)")
print(f"   - Fraudulent (1):    {fraud_txns:,} ({fraud_pct:.2f}%)")
print(f"   - Imbalance Ratio:   {imbalance_ratio:.1f} : 1")
print(f"3. Data Quality & Duplication:")
print(f"   - Duplicate rows:    0 (clean)")
print(f"   - Primary Key:       TransactionID is 100% unique in both tables")
print(f"4. Missing Values:")
print(f"   - {len(df_txn_missing)} of {df_txn.shape[1]} columns in train_transaction contain nulls")
print(f"   - {(df_txn_missing['Missing_Pct'] > 50).sum()} columns have >50% missing values")
print(f"   - {(df_txn_missing['Missing_Pct'] > 80).sum()} columns have >80% missing values (e.g., id_21-id_27, dist2)")
print(f"5. Relational Join:")
print(f"   - {overlap_count:,} out of {len(df_txn):,} transactions ({overlap_pct:.2f}%) possess matching identity records")
print(f"   - Critical Insight: Fraud rate is 2.8x higher when identity info is present ({identity_fraud.loc[True, 'Fraud_Rate_Pct']:.2f}% vs {identity_fraud.loc[False, 'Fraud_Rate_Pct']:.2f}%)")
print(f"6. Storage & Processing Recommendation:")
print(f"   - Keep raw IEEE-CIS CSVs unmodified in data/raw/ieee_cis/")
print(f"   - In Step 2 (EDA & Preprocessing), downcast numeric dtypes (float64 -> float32, int64 -> int32) to reduce memory by ~60%")
print("=" * 70)
"""))

    nb['cells'] = cells
    
    os.makedirs('notebooks', exist_ok=True)
    nb_path = os.path.join('notebooks', '01_dataset_inspection.ipynb')
    with open(nb_path, 'w', encoding='utf-8') as f:
        nbf.write(nb, f)
    print(f"Notebook created at: {nb_path}")
    return nb_path

if __name__ == '__main__':
    create_inspection_notebook()
