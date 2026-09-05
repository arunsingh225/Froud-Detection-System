class RiskService:
    """Calculates risk levels and operational fraud decisions."""

    @staticmethod
    def calculate_risk_level(probability: float) -> str:
        """
        Classify continuous fraud probability into actionable operational risk tiers:
          - 0.00 to 0.20 -> LOW
          - 0.20 to 0.50 -> MEDIUM
          - 0.50 to 0.80 -> HIGH
          - 0.80 to 1.00 -> CRITICAL
        """
        if probability < 0.20:
            return "LOW"
        elif probability < 0.50:
            return "MEDIUM"
        elif probability < 0.80:
            return "HIGH"
        else:
            return "CRITICAL"

    @staticmethod
    def evaluate_fraud_decision(probability: float, threshold: float = 0.80) -> bool:
        """Evaluate binary classification decision against operating threshold."""
        return bool(probability >= threshold)
