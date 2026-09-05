# Suspicious Activity Indicators & Red Flags
## Document ID: SOP-IND-2026-02
## Category: Typology & Behavioral Red Flags

### Section 1: Account Takeover (ATO) Indicators
1. **Device Fingerprint Mismatch**: High-value payment initiated from a device hardware fingerprint that has zero prior association with the customer's identity registry within the last 180 days.
2. **OS Rooting and Jailbreak Flags**: Execution on Android devices with compromised keystores (`su` binary present, Magisk active) or iOS devices with Cydia/checkra1n subsystems.
3. **Session Hijacking & Proxying**: Presence of commercial VPN exit nodes, Tor routing, or data center IP addresses (hosting providers like DigitalOcean, Linode, AWS) rather than residential ISP allocations.
4. **Impossible Travel Anomaly**: Transactions recorded in physical locations separated by geographical distance exceeding normal commercial flight speeds within the elapsed timestamp interval.

### Section 2: Synthetic Identity & Mules
1. **Dormant Account Awakening**: Accounts with negligible activity (< ₹5,000 monthly) suddenly receiving or dispersing large single transfers (> ₹250,000) within 48 hours of activation.
2. **Rapid Pass-Through Velocity**: Inflow followed immediately (< 10 minutes) by rapid outward disbursement via multiple peer-to-peer UPI handles or ATM withdrawals.
3. **Mismatched KYC Artifacts**: High risk scores combined with pending, failed, or incomplete KYC documentation validation records.

### Section 3: Merchant Category Code (MCC) Risk Weighting
1. **High-Risk MCCs**: Transactions in categories 6051 (Non-Financial Institutions – Foreign Currency, Cryptocurrency), 7995 (Betting & Gambling), and 5944 (Jewelry & Precious Metals) carry higher risk weighting and lower intervention thresholds.
2. **VASP Compliance**: Crypto asset service providers (VASPs) lacking verified FIU-IND or FinCEN registration require immediate enhanced scrutiny and source-of-funds verification.
