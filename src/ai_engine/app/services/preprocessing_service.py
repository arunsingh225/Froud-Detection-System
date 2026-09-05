import numpy as np
import pandas as pd
from typing import Dict, Any, List
from app.schemas.prediction import PredictionRequest
from app.logging_config import logger


class PreprocessingService:
    """
    Transforms raw incoming transaction payloads into the exact 464-feature 
    matrix expected by the trained LightGBM fraud model.
    """

    def __init__(self, preprocessing_bundle: Dict[str, Any]):
        self.model_features: List[str] = preprocessing_bundle.get("model_features", [])
        self.expected_feature_count: int = len(self.model_features)
        self.frequency_maps: Dict[str, Dict[Any, float]] = preprocessing_bundle.get("frequency_maps", {})
        self.categorical_vocabularies: Dict[str, Dict[str, int]] = preprocessing_bundle.get("categorical_vocabularies", {})
        logger.info(f"PreprocessingService initialized with {self.expected_feature_count} expected model features.")

    def transform(self, request: PredictionRequest) -> pd.DataFrame:
        """
        Derive engineered features, apply persisted training frequency & categorical
        vocabularies, and assemble the single-row DataFrame.
        """
        raw: Dict[str, Any] = request.model_dump()
        row: Dict[str, Any] = {}

        # 1. Transaction Amount Features
        amt = float(raw.get("TransactionAmt", 0.0))
        amt_decimal = float(np.round(amt - np.floor(amt), 4))
        row["TransactionAmt"] = np.float32(amt)
        row["TransactionAmt_log"] = np.float32(np.log1p(amt))
        row["TransactionAmt_decimal"] = np.float32(amt_decimal)
        row["TransactionAmt_is_round"] = np.int8(1 if amt_decimal == 0.0 else 0)

        # 2. Relative Elapsed Time Features & Harmonic Trigonometric Cycles
        dt = int(raw.get("TransactionDT") or 86400)
        hour = int((dt // 3600) % 24)
        day = int(dt // (3600 * 24))
        week = int(dt // (3600 * 24 * 7))
        row["TransactionDT"] = np.int32(dt)
        row["TransactionHour"] = np.int8(hour)
        row["TransactionDay"] = np.int16(day)
        row["TransactionWeek"] = np.int8(week)
        row["TransactionHour_sin"] = np.float32(np.sin(2 * np.pi * hour / 24.0))
        row["TransactionHour_cos"] = np.float32(np.cos(2 * np.pi * hour / 24.0))

        # 3. Identity and Hardware Availability Indicators
        device_info = raw.get("DeviceInfo")
        device_type = raw.get("DeviceType")
        os_info = raw.get("id_30")
        browser_info = raw.get("id_31")
        id_01 = raw.get("id_01")

        has_id = (
            id_01 is not None or
            (device_info and str(device_info) != "nan") or
            (os_info and str(os_info) != "nan") or
            (browser_info and str(browser_info) != "nan")
        )
        row["has_identity"] = np.int8(1 if has_id else 0)
        row["device_info_available"] = np.int8(1 if (device_info or device_type) else 0)
        row["os_info_available"] = np.int8(1 if os_info else 0)
        row["browser_info_available"] = np.int8(1 if browser_info else 0)

        # 4. Composite Card Identifiers
        c1 = raw.get("card1")
        c2 = raw.get("card2")
        c3 = raw.get("card3")
        c4 = raw.get("card4")
        c5 = raw.get("card5")
        c6 = raw.get("card6")

        c1_str = str(c1) if c1 is not None else "NA"
        c2_str = str(c2) if c2 is not None else "NA"
        c3_str = str(c3) if c3 is not None else "NA"
        c4_str = str(c4) if c4 is not None else "NA"
        c5_str = str(c5) if c5 is not None else "NA"
        c6_str = str(c6) if c6 is not None else "NA"

        comp_c12 = f"{c1_str}_{c2_str}"
        comp_c13 = f"{c1_str}_{c3_str}"
        comp_c15 = f"{c1_str}_{c5_str}"
        comp_c46 = f"{c4_str}_{c6_str}"

        # 5. Composite Address Identifiers and Missingness
        a1 = raw.get("addr1")
        a2 = raw.get("addr2")
        a1_str = str(a1) if a1 is not None else "NA"
        a2_str = str(a2) if a2 is not None else "NA"
        comp_a12 = f"{a1_str}_{a2_str}"
        row["addr1_isna"] = np.int8(1 if a1 is None else 0)
        row["addr2_isna"] = np.int8(1 if a2 is None else 0)

        # 6. Email Interactions
        p_email = raw.get("P_emaildomain")
        r_email = raw.get("R_emaildomain")
        p_valid = bool(p_email and str(p_email) not in ["nan", "None"])
        r_valid = bool(r_email and str(r_email) not in ["nan", "None"])
        row["email_both_provided"] = np.int8(1 if (p_valid and r_valid) else 0)
        row["email_domain_match"] = np.int8(1 if (p_valid and r_valid and p_email == r_email) else 0)

        # 7. Structural Missingness Indicators from Step 2
        row["dist1_isna"] = np.int8(1 if raw.get("dist1") is None else 0)
        row["dist2_isna"] = np.int8(1 if raw.get("dist2") is None else 0)
        row["D2_isna"] = np.int8(1 if raw.get("D2") is None else 0)
        row["P_emaildomain_isna"] = np.int8(1 if not p_valid else 0)
        row["R_emaildomain_isna"] = np.int8(1 if not r_valid else 0)
        row["id_01_isna"] = np.int8(1 if id_01 is None else 0)
        row["id_31_isna"] = np.int8(1 if not browser_info else 0)

        # 8. Training-Fitted Relative Frequencies (No Data Leakage)
        c1_map = self.frequency_maps.get("card1", {})
        c12_map = self.frequency_maps.get("card1_card2", {})
        a1_map = self.frequency_maps.get("addr1", {})
        p_map = self.frequency_maps.get("P_emaildomain", {})

        row["card1_frequency"] = np.float32(c1_map.get(c1, 0.0) if c1 is not None else 0.0)
        row["card1_card2_frequency"] = np.float32(c12_map.get(comp_c12, 0.0))
        row["addr1_frequency"] = np.float32(a1_map.get(a1, 0.0) if a1 is not None else 0.0)
        row["P_emaildomain_frequency"] = np.float32(p_map.get(p_email, 0.0) if p_valid else 0.0)

        # 9. Categorical Encodings (Map string to training integer vocabulary code, default -1)
        composite_strings = {
            "card1_card2": comp_c12,
            "card1_card3": comp_c13,
            "card1_card5": comp_c15,
            "card4_card6": comp_c46,
            "addr1_addr2": comp_a12
        }

        for cat_col, vocab in self.categorical_vocabularies.items():
            if cat_col in composite_strings:
                val_str = composite_strings[cat_col]
            else:
                raw_val = raw.get(cat_col)
                val_str = str(raw_val) if raw_val is not None else "nan"
            
            code = vocab.get(val_str, -1)
            row[cat_col] = np.int32(code)

        # 10. Populate All Remaining Model Features
        for feat in self.model_features:
            if feat not in row:
                if feat in raw and raw[feat] is not None:
                    try:
                        row[feat] = np.float32(raw[feat])
                    except (ValueError, TypeError):
                        row[feat] = np.float32(np.nan)
                else:
                    # LightGBM handles missing numerical values natively as NaN
                    row[feat] = np.float32(np.nan)

        # 11. Assemble DataFrame in strict feature order
        df = pd.DataFrame([row])[self.model_features]

        # 12. Safety Assertion on feature count
        if df.shape[1] != self.expected_feature_count:
            raise ValueError(
                f"Feature count mismatch: produced {df.shape[1]} features, "
                f"expected {self.expected_feature_count} features."
            )

        return df
