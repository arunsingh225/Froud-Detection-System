import pandas as pd
import numpy as np
import lightgbm as lgb
import pickle
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    r2_score,
    classification_report,
    confusion_matrix
)

# ── 1. LOAD DATA ──────────────────────────────────────────────────
# Apna dataset path yahan daalo
df = pd.read_csv('data/raw/ieee_cis/train_transaction.csv')

# Target aur features alag karo
X = df.drop(['isFraud', 'TransactionID'], axis=1)
y = df['isFraud']

# Categorical columns ko encode karo
cat_cols = X.select_dtypes(include='object').columns
for col in cat_cols:
    X[col] = X[col].astype('category').cat.codes

# Missing values fill karo
X = X.fillna(-999)

# ── 2. TRAIN / TEST SPLIT ─────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y        # Important for imbalanced fraud data
)

# ── 3. TRAIN LIGHTGBM MODEL ───────────────────────────────────────
model = lgb.LGBMClassifier(
    n_estimators=500,
    learning_rate=0.05,
    num_leaves=63,
    random_state=42,
    class_weight='balanced'   # Handles class imbalance
)

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
)

# ── 4. PREDICTIONS ────────────────────────────────────────────────
y_pred        = model.predict(X_test)             # 0 or 1
y_pred_proba  = model.predict_proba(X_test)[:, 1] # Probability scores

# ── 5. ALL METRICS ────────────────────────────────────────────────
accuracy   = accuracy_score(y_test, y_pred)
precision  = precision_score(y_test, y_pred)
recall     = recall_score(y_test, y_pred)
f1         = f1_score(y_test, y_pred)
roc_auc    = roc_auc_score(y_test, y_pred_proba)
r2         = r2_score(y_test, y_pred_proba)  # R2 on probabilities

print("=" * 45)
print("      FRAUDGUARD AI — MODEL METRICS")
print("=" * 45)
print(f"  Accuracy       : {accuracy:.4f}  ({accuracy*100:.2f}%)")
print(f"  Precision      : {precision:.4f}  ({precision*100:.2f}%)")
print(f"  Recall         : {recall:.4f}  ({recall*100:.2f}%)")
print(f"  F1 Score       : {f1:.4f}  ({f1*100:.2f}%)")
print(f"  ROC-AUC Score  : {roc_auc:.4f}  ({roc_auc*100:.2f}%)")
print(f"  R2 Score       : {r2:.4f}")
print("=" * 45)

# Detailed report
print("\n📊 CLASSIFICATION REPORT:")
print(classification_report(y_test, y_pred,
      target_names=['Legitimate', 'Fraud']))

# Confusion Matrix
cm = confusion_matrix(y_test, y_pred)
print("🔢 CONFUSION MATRIX:")
print(f"  True Negative  (Correct Legit)  : {cm[0][0]}")
print(f"  False Positive (Wrong Fraud)    : {cm[0][1]}")
print(f"  False Negative (Missed Fraud)   : {cm[1][0]}")
print(f"  True Positive  (Correct Fraud)  : {cm[1][1]}")

# Save model
with open('fraud_model.pkl', 'wb') as f:
    pickle.dump(model, f)
print("\n✅ Model saved as fraud_model.pkl")
