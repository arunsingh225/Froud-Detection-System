# Transaction Monitoring Standard Operating Procedure
## Document ID: SOP-MON-2026-04
## Scope: Real-Time Fraud Alert Triage & Response

### Section 1: Alert Triage Severity Categories
1. **Critical Severity**:
   - ML Fraud Probability ≥ 90.00% OR confirmed compromised credentials.
   - Recommended Action: `HIGH_PRIORITY_INVESTIGATION`.
   - Response SLA: Within 15 minutes by Tier-2 Fraud Specialist.
2. **High Severity**:
   - ML Fraud Probability between 80.00% and 89.99% OR impossible travel confirmed.
   - Recommended Action: `ESCALATE_FOR_MANUAL_REVIEW`.
   - Response SLA: Within 1 hour.
3. **Medium Severity**:
   - ML Fraud Probability between 50.00% and 79.99% OR unverified new device.
   - Recommended Action: `REQUEST_ADDITIONAL_REVIEW`.
   - Response SLA: Within 4 hours.
4. **Low Severity**:
   - ML Fraud Probability < 50.00% with minor anomaly indicators.
   - Recommended Action: `MONITOR` or `NO_ACTION`.
   - Response SLA: Daily batch review.

### Section 2: Recommended Action Governance
The AI investigative assistant produces one of five calibrated recommendations:
- `NO_ACTION`: Low risk, consistent with historical behavior, legitimate variance.
- `MONITOR`: Low-to-medium risk, watch for velocity escalation over the next 24 hours.
- `REQUEST_ADDITIONAL_REVIEW`: Medium risk, requires investigator clarification or customer contact.
- `ESCALATE_FOR_MANUAL_REVIEW`: High risk, strong probability of unauthorized account takeover, hold settlement.
- `HIGH_PRIORITY_INVESTIGATION`: Critical threat, severe anomaly indicators across multiple evidentiary pillars, expedited senior compliance escalation.
