# Fraud Investigation Standard Operating Procedure (SOP)
## Document ID: SOP-INV-2026-01
## Effective Date: January 2026
## Authority: Enterprise Fraud Risk Management

### Section 1: Scope and Applicability
This standard operating procedure governs the intake, multi-vector evidence synthesis, risk triage, and formal escalation of flagged financial transactions and high-severity fraud alerts across all payment channels including UPI, NEFT/RTGS, Card Present, Card Not Present (CNP), and Cross-Border wires.

### Section 2: Transaction Velocity and Out-of-Pattern Spikes
1. **Velocity Anomaly Thresholds**: Any account initiating three (3) or more high-value transfers within a rolling 60-minute window, where the cumulative total exceeds 300% of the customer's trailing 90-day baseline average, shall be immediately placed into mandatory Tier-2 investigative review.
2. **First-Time Destination Exposure**: Transactions routed to new beneficiary accounts, cryptocurrency exchange platforms (VASPs), or offshore jurisdictions within 24 hours of a credential or device modification must be flagged as high-risk account takeover (ATO) candidates.
3. **Structuring Indicators**: Repeated transfers just below regulatory currency reporting thresholds (e.g., transfers between ₹45,000 and ₹49,999 or $9,000 and $9,999) constitute suspected smurfing/structuring and mandate immediate compliance logging.

### Section 3: Evidence Corroboration Standard
An investigator or AI investigative agent must never rely on a single anomaly vector. A substantiated case file requires multi-vector corroboration across at least two (2) of the following five evidentiary pillars:
- **Pillar A (Transaction)**: Substantial deviation in amount, velocity, or MCC category from customer historical baseline.
- **Pillar B (Location)**: Impossible travel velocity (>800 km/h between successive transactions) or known high-risk IP geolocation.
- **Pillar C (Device & Network)**: Modified operating system (rooted/jailbroken), emulator execution, or Tor/commercial anonymizing VPN routing.
- **Pillar D (Historical Alerts)**: Prior unassigned alerts, recent chargeback disputes, or previous investigations on file.
- **Pillar E (ML Scoring)**: Supervised machine learning fraud probability exceeding the designated production operating threshold (0.80 / 80%).

### Section 4: Prohibited Autonomous Actions
1. **Human Authority**: Neither automated rule engines nor AI investigative agents may independently initiate irreversible customer harm, such as freezing funds, permanent account termination, or submitting regulatory SAR/STR filings without signed human investigator authorization.
2. **Temporary Precautionary Holds**: Automated systems may only recommend "Auto-Flag for Review" or "Request Additional Review" to pause settlement pending human analyst verification.
