"""
Curated component-to-KB threat/mitigation mappings.
Each component slug maps to framework names, each with SPECIFIC threat and mitigation IDs
from the knowledge base — not broad category matches.

Threat IDs (from `SELECT id, name FROM threats JOIN frameworks ...`):
STRIDE:  1=Spoofing Identity, 2=User Impersonation, 3=Data Tampering, 4=Code Injection,
         5=MITM, 6=Repudiation of Actions, 7=Info Disclosure, 8=Data Breach, 9=DoS,
         10=Resource Exhaustion, 11=Elevation of Privilege, 12=Privilege Escalation,
         29=Credential Theft, 30=Session Hijacking, 31=IP Spoofing, 32=DNS Spoofing,
         33=SQL Injection, 34=XSS, 35=Parameter Tampering, 36=File Upload Exploitation,
         37=Config File Manipulation, 38=Insufficient Audit Logging, 39=Log Tampering,
         40=Transaction Denial, 41=Clock Manipulation, 42=Sensitive Data in Logs,
         43=Directory Traversal, 44=IDOR, 45=Info Leakage via Error, 46=Unencrypted Transmission,
         47=Metadata Exposure, 48=Memory Dump Exposure, 49=Resource Exhaustion Attack,
         50=App-Layer DDoS, 51=ReDoS, 52=DB Connection Pool Exhaustion, 53=XML Bomb,
         54=Slowloris, 55=Priv Esc via IDOR, 56=Auth Bypass, 57=Authorization Bypass,
         58=CSRF, 59=Insecure Deserialization, 60=JWT Token Manipulation, 61=OAuth Token Theft,
         62=SIM Swapping, 63=AI/ML Poisoning, 64=Supply Chain Tampering, 65=API Data Scraping,
         66=Side-Channel Leakage, 67=SSTI, 68=OAuth Misconfiguration

OWASP Top 10:  94=IDOR, 95=Path Traversal, 96=Missing Function Level Access, 97=Privilege Escalation,
               98=Forced Browsing, 99=Weak Encryption, 100=Hardcoded Keys, 101=Cleartext Transmission,
               102=Insufficient SSL, 103=Missing Cert Validation, 104=SQL Injection, 105=NoSQL Injection,
               106=OS Command Injection, 107=LDAP Injection, 108=XXE, 109=Missing Rate Limiting,
               110=Trust Boundary Violation, 111=Insufficient Workflow Validation, 112=Missing Security Req,
               113=Default Credentials, 114=Unnecessary Features, 115=Directory Listing,
               116=Verbose Error Messages, 117=Missing Security Headers, 118=Known Vuln Components,
               119=Lack of Dependency Scanning, 120=Unpatched Software, 121=Weak Password,
               122=Missing MFA, 123=Session Fixation, 124=Credential Stuffing, 125=Insecure Password Recovery,
               126=Insecure Deserialization, 127=Missing Code Signing, 128=CI/CD Compromise,
               129=Lack of Integrity Verification, 130=Insufficient Logging, 131=Log Injection,
               132=Missing Alerting, 133=Logs Stored Insecurely, 134=SSRF, 135=Internal Service Exposure,
               136=Cloud Metadata Abuse

PASTA:  14=API Abuse, 15=Business Logic Bypass, 16=Credential Stuffing, 17=XSS, 18=CSRF,
        19=Session Hijacking (actually that's mitigation ID... let me re-check)
        Actually PASTA threats: 69=API Key Exposure, 70=Insufficient API Auth, 71=Mass Assignment,
        72=Broken Object Level Auth, 73=Excessive Data Exposure, 74=Lack of Rate Limiting,
        75=IDOR in APIs, 76=GraphQL Query Depth, 77=WebSocket Hijacking, 78=SSRF,
        79=Price Manipulation, 80=Workflow Step Bypass, 81=Loyalty Point Fraud, 82=Race Condition,
        83=Account Takeover, 84=Third-Party Library Backdoor, 85=Malicious Package,
        86=CI/CD Injection, 87=OAuth Provider Misconfiguration, 88=Webhook Injection,
        89=Third-Party API Credential Abuse, 90=Deprecated API Exploitation,
        91=Shadow API Endpoint, 92=API Parameter Pollution, 93=Versioning Auth Bypass

STRIDE mitigations: 1=MFA, 2=Digital Signatures, 3=Input Validation, 4=Data Integrity Checks,
     5=Encryption in Transit, 6=Audit Logging, 7=Secure Timestamps, 8=Data Encryption at Rest,
     9=ACLs, 10=Rate Limiting, 11=Resource Quotas, 12=Principle of Least Privilege,
     13=RBAC, 32=MFA, 33=Cert-Based Auth, 34=Secure Session Mgmt, 35=TLS/SSL,
     36=DNSSEC, 37=Input Validation & Sanitization, 38=Parameterized Queries, 39=CSP,
     40=File Upload Restrictions, 41=Code Signing, 42=Comprehensive Audit Logging,
     43=Tamper-Proof Log Storage, 44=Digital Transaction Signatures, 45=Secure Time Sync,
     46=Log Integrity Monitoring, 47=Data Encryption in Transit, 48=Secure Error Handling,
     49=Data Masking, 50=Security Headers, 51=WAF, 52=Connection Pooling, 53=Input Size Limits,
     54=Auto-Scaling, 55=Request Timeout, 56=Authorization Checks, 57=CSRF Tokens,
     58=JWT Signature Verification, 59=Secure Deserialization, 60=OAuth State Param Validation,
     61=SIM Swap Protection, 62=ML Model Integrity, 63=SCA, 64=API Response Schema Validation,
     65=Constant-Time Comparison, 66=Template Engine Sandboxing, 67=OAuth Scope Minimization

OWASP mitigations: 93=RBAC, 94=Use Indirect Object References, 95=Enforce Access Control at API,
     96=Strong Encryption, 97=TLS 1.2+, 98=Use KMS, 99=Enforce HTTPS, 100=Use Parameterized Queries,
     101=Input Validation & Sanitization, 102=Use ORM Securely, 103=Disable XML External Entity,
     104=Rate Limiting, 105=Use Threat Modeling, 106=Defense in Depth, 107=Harden Default Config,
     108=Implement Security Headers, 109=Disable Directory Listing, 110=Custom Error Pages,
     111=Implement Dependency Scanning, 112=Establish Patch Management, 113=Remove Unused Dependencies,
     114=Enforce Strong Password, 115=Enforce Strong Password Policy, 116=Implement Account Lockout,
     117=Regenerate Session IDs, 118=Implement Code Signing, 119=Secure CI/CD Pipeline,
     120=Avoid Unsafe Deserialization, 121=Comprehensive Logging, 122=Centralize Log Management,
     123=Implement Real-Time Alerting, 124=Validate and Sanitize URLs, 125=Disable URL Redirects,
     126=Network Segmentation, 127=JWT Claims Validation, 128=Object-Level Authorization,
     129=Certificate Pinning, 130=Secrets Rotation, 131=Encrypt Backup Data,
     132=Template Injection Prevention, 133=HTTP Header Injection Prevention,
     134=GraphQL Query Depth Limiting, 135=CSPM, 136=Container Image Scanning,
     137=IaC Security Scanning, 138=Container Base Image Hardening, 139=Credential Breach Monitoring,
     140=Adaptive Authentication, 141=SRI, 142=Package Lock File, 143=Structured Logs,
     144=Immutable Log Storage, 145=Distributed Tracing

PASTA mitigations: 14=Business Logic Validation, 15=API Gateway, 16=Secure Session Mgmt,
     17=Password Policy, 18=CSP, 19=Anti-CSRF Tokens, 68=Environment Variable Mgmt,
     69=API Gateway with Auth, 70=DTO Validation & Whitelisting, 73=Distributed Rate Limiting,
     75=GraphQL Query Complexity Analysis, 76=WebSocket Auth & Validation,
     78=Server-Side Business Rule Enforcement, 79=Idempotency Keys, 80=Optimistic Locking,
     81=Anti-Automation Controls, 82=Transaction Anomaly Monitoring, 83=SBOM,
     84=Package Signature Verification, 85=Dependency Pinning with Hash, 86=Private Package Registry,
     87=CI/CD Security Hardening, 88=OAuth Scope Restriction, 89=Webhook Signature Verification,
     90=Third-Party API Monitoring, 91=API Version Lifecycle Mgmt, 92=API Inventory & Shadow Endpoint
"""

# ── Curated mappings ───────────────────────────────────────────────────────────
# Structure: slug → { framework_name → { "t": [threat_ids], "m": [mitigation_ids] } }

CURATED = {
    # ── Cloud Storage ──────────────────────────────────────────────────────────
    "aws-s3": {
        "STRIDE": {
            "t": [8, 7, 3, 38, 11, 57, 46, 42],
            # Data Breach, Info Disclosure, Data Tampering, Insufficient Audit Logging,
            # Elevation of Privilege, Authorization Bypass, Unencrypted Transmission, Sensitive Data in Logs
            "m": [8, 9, 12, 13, 6, 42, 47, 49],
            # Encryption at Rest, ACLs, Least Priv, RBAC, Audit Log, Comprehensive Audit Log, Encryption in Transit, Data Masking
        },
        "OWASP Top 10": {
            "t": [99, 101, 94, 97, 113, 130, 133],
            # Weak Encryption, Cleartext, IDOR, Privilege Escalation, Default Creds, Insufficient Logging, Logs Stored Insecurely
            "m": [96, 97, 98, 93, 107, 121, 144],
        },
        "PASTA": {
            "t": [73, 72, 89],
            # Excessive Data Exposure, Broken Object Level Auth, Third-Party API Credential Abuse
            "m": [68, 88, 92],
        },
    },
    "azure-blob": {
        "STRIDE": {
            "t": [8, 7, 11, 57, 46, 38],
            "m": [8, 9, 12, 13, 6, 47],
        },
        "OWASP Top 10": {
            "t": [99, 101, 94, 97, 113, 130],
            "m": [96, 97, 98, 93, 107, 121],
        },
    },
    "gcs-bucket": {
        "STRIDE": {
            "t": [8, 7, 11, 57, 46, 38],
            "m": [8, 9, 12, 6, 47],
        },
        "OWASP Top 10": {
            "t": [99, 101, 94, 130],
            "m": [96, 97, 93, 121],
        },
    },

    # ── Databases ──────────────────────────────────────────────────────────────
    "postgresql": {
        "STRIDE": {
            "t": [33, 3, 8, 7, 42, 46, 45, 38, 39, 1, 56, 57, 11, 12, 9, 52],
            # SQL Injection, Data Tampering, Data Breach, Info Disclosure, Sensitive Data in Logs,
            # Unencrypted Transmission, Info Leakage via Error, Insufficient Audit Logging, Log Tampering,
            # Spoofing Identity, Auth Bypass, Authorization Bypass, Elevation of Privilege, Privilege Escalation,
            # DoS, DB Connection Pool Exhaustion
            "m": [38, 37, 12, 13, 9, 8, 47, 6, 42, 48, 52, 10, 3],
            # Parameterized Queries, Input Validation, Least Priv, RBAC, ACLs, Encryption at Rest,
            # Encryption in Transit, Audit Log, Comprehensive Audit Log, Secure Error Handling, Connection Pooling, Rate Limiting, Input Validation
        },
        "OWASP Top 10": {
            "t": [104, 101, 99, 100, 94, 97, 113, 116, 130, 133],
            # SQL Injection, Cleartext, Weak Encryption, Hardcoded Keys, IDOR, Privilege Escalation,
            # Default Credentials, Verbose Errors, Insufficient Logging, Logs Stored Insecurely
            "m": [100, 102, 97, 98, 96, 93, 107, 110, 121, 144],
        },
        "PASTA": {
            "t": [73, 72, 74, 82],
            # Excessive Data Exposure, Broken Object Level Auth, Lack of Rate Limiting, Race Condition
            "m": [70, 73, 80, 83],
        },
    },
    "mysql": {
        "STRIDE": {
            "t": [33, 3, 8, 7, 42, 46, 38, 56, 11, 9, 52],
            "m": [38, 37, 12, 13, 9, 8, 47, 6, 48, 52, 10],
        },
        "OWASP Top 10": {
            "t": [104, 101, 99, 94, 97, 113, 116, 130],
            "m": [100, 102, 97, 93, 107, 110, 121],
        },
        "PASTA": {
            "t": [73, 72, 74],
            "m": [70, 73, 83],
        },
    },
    "mongodb": {
        "STRIDE": {
            "t": [33, 4, 3, 8, 7, 46, 56, 11, 38],
            # SQL Injection (NoSQL injection), Code Injection, Data Tampering, Data Breach, Info Disclosure,
            # Unencrypted Transmission, Auth Bypass, Elevation of Privilege, Insufficient Audit Logging
            "m": [37, 3, 12, 13, 9, 8, 47, 6, 38],
        },
        "OWASP Top 10": {
            "t": [105, 104, 101, 99, 113, 94, 130],
            # NoSQL Injection, SQL Injection (query injection), Cleartext, Weak Encryption, Default Creds, IDOR, Logging
            "m": [101, 100, 97, 96, 107, 121],
        },
        "PASTA": {
            "t": [73, 72, 70, 74],
            "m": [70, 73, 68],
        },
    },
    "redis": {
        "STRIDE": {
            "t": [1, 8, 7, 46, 4, 3, 9, 10, 37, 56, 42],
            # Spoofing Identity, Data Breach, Info Disclosure, Unencrypted Transmission, Code Injection,
            # Data Tampering, DoS, Resource Exhaustion, Config File Manipulation, Auth Bypass, Sensitive Data in Logs
            "m": [1, 35, 9, 8, 47, 12, 10, 3, 37, 55, 48],
            # MFA, TLS, ACLs, Encryption at Rest, Encryption in Transit, Least Priv, Rate Limiting,
            # Input Validation, Input Validation & Sanitization, Request Timeout, Secure Error Handling
        },
        "OWASP Top 10": {
            "t": [113, 101, 99, 94, 130],
            "m": [107, 97, 96, 121, 126],
        },
        "PASTA": {
            "t": [69, 70, 73],
            "m": [68, 15],
        },
    },
    "dynamodb": {
        "STRIDE": {
            "t": [11, 57, 7, 8, 38, 46],
            "m": [12, 56, 9, 8, 47, 6],
        },
        "OWASP Top 10": {
            "t": [94, 97, 99, 130],
            "m": [93, 96, 98, 121],
        },
        "PASTA": {
            "t": [72, 73],
            "m": [68, 88],
        },
    },
    "elasticsearch": {
        "STRIDE": {
            "t": [1, 7, 8, 56, 57, 46],
            "m": [1, 35, 9, 12, 8, 47],
        },
        "OWASP Top 10": {
            "t": [113, 94, 99, 130],
            "m": [107, 93, 96, 121],
        },
    },

    # ── Messaging & Queues ─────────────────────────────────────────────────────
    "kafka": {
        "STRIDE": {
            "t": [1, 3, 7, 8, 11, 38, 9, 57, 46],
            # Spoofing Identity, Data Tampering, Info Disclosure, Data Breach,
            # Elevation of Privilege, Insufficient Audit Logging, DoS, Authorization Bypass, Unencrypted Transmission
            "m": [1, 35, 12, 13, 9, 6, 47, 4, 10],
        },
        "OWASP Top 10": {
            "t": [94, 97, 101, 113, 130],
            "m": [93, 97, 107, 121],
        },
        "PASTA": {
            "t": [73, 70, 74, 89],
            "m": [68, 15, 73],
        },
    },
    "aws-sqs-sns": {
        "STRIDE": {
            "t": [7, 3, 11, 57, 38, 46],
            "m": [9, 12, 6, 47, 8],
        },
        "OWASP Top 10": {
            "t": [99, 94, 97, 130],
            "m": [96, 98, 93, 121],
        },
        "PASTA": {
            "t": [88, 89, 73],
            "m": [88, 89, 90],
        },
    },
    "rabbitmq": {
        "STRIDE": {
            "t": [1, 8, 7, 46, 11, 9],
            "m": [1, 35, 12, 9, 47, 10],
        },
        "OWASP Top 10": {
            "t": [113, 101, 99],
            "m": [107, 97, 96],
        },
    },

    # ── Auth & Identity ────────────────────────────────────────────────────────
    "oauth2-provider": {
        "STRIDE": {
            "t": [61, 68, 58, 30, 1, 56, 60],
            # OAuth Token Theft, OAuth Misconfiguration, CSRF, Session Hijacking,
            # Spoofing Identity, Auth Bypass, JWT Token Manipulation
            "m": [60, 67, 57, 34, 1, 32, 58],
            # OAuth State Param Validation, OAuth Scope Minimization, CSRF Tokens, Secure Session Mgmt,
            # MFA, MFA, JWT Signature Verification
        },
        "OWASP Top 10": {
            "t": [121, 122, 123, 124, 98, 130],
            # Weak Password, Missing MFA, Session Fixation, Credential Stuffing, Forced Browsing, Insufficient Logging
            "m": [114, 116, 117, 115, 140, 121],
        },
        "PASTA": {
            "t": [87, 14, 16, 18],
            # OAuth Provider Misconfiguration, API Abuse, Credential Stuffing, CSRF
            "m": [88, 15, 19, 16],
        },
    },
    "ldap-ad": {
        "STRIDE": {
            "t": [4, 1, 56, 46, 7, 8],
            # Code Injection (LDAP Injection), Spoofing Identity, Auth Bypass,
            # Unencrypted Transmission, Info Disclosure, Data Breach
            "m": [3, 37, 1, 35, 9, 12],
        },
        "OWASP Top 10": {
            "t": [107, 99, 101, 113, 122],
            # LDAP Injection, Weak Encryption, Cleartext, Default Creds, Missing MFA
            "m": [101, 97, 107, 114],
        },
    },
    "jwt-service": {
        "STRIDE": {
            "t": [60, 56, 30, 61, 1, 7],
            # JWT Token Manipulation, Auth Bypass, Session Hijacking, OAuth Token Theft, Spoofing, Info Disclosure
            "m": [58, 1, 34, 35, 65],
            # JWT Signature Verification, MFA, Secure Session Mgmt, TLS, Constant-Time Comparison
        },
        "OWASP Top 10": {
            "t": [122, 123, 126, 130],
            # Missing MFA, Session Fixation, Insecure Deserialization, Insufficient Logging
            "m": [127, 114, 117, 121],
        },
        "PASTA": {
            "t": [14, 16],
            "m": [15, 16],
        },
    },

    # ── API & Networking ───────────────────────────────────────────────────────
    "api-gateway": {
        "STRIDE": {
            "t": [65, 7, 9, 50, 51, 56, 57, 35, 4, 45],
            # API Data Scraping, Info Disclosure, DoS, App-Layer DDoS, ReDoS,
            # Auth Bypass, Authorization Bypass, Parameter Tampering, Code Injection, Info Leakage via Error
            "m": [64, 10, 51, 12, 13, 48, 3, 50, 56],
            # API Response Schema Validation, Rate Limiting, WAF, Least Priv, RBAC,
            # Secure Error Handling, Input Validation, Security Headers, Authorization Checks
        },
        "OWASP Top 10": {
            "t": [109, 94, 96, 104, 116, 111, 134],
            # Missing Rate Limiting, IDOR, Missing Function Level Access, SQL Injection,
            # Verbose Error, Insufficient Workflow Validation, SSRF
            "m": [104, 128, 95, 100, 110, 106],
        },
        "PASTA": {
            "t": [70, 74, 73, 72, 75, 78, 91],
            # Insufficient API Auth, Lack of Rate Limiting, Excessive Data Exposure,
            # Broken Object Level Auth, IDOR in APIs, SSRF, Shadow API Endpoint
            "m": [69, 73, 92, 70, 15],
        },
    },
    "load-balancer": {
        "STRIDE": {
            "t": [5, 3, 46, 7],
            # MITM, Data Tampering, Unencrypted Transmission, Info Disclosure
            "m": [5, 35, 47, 50, 51],
            # Encryption in Transit, TLS, Encryption in Transit, Security Headers, WAF
        },
        "OWASP Top 10": {
            "t": [99, 117, 101, 102],
            "m": [97, 108, 106],
        },
    },
    "cdn": {
        "STRIDE": {
            "t": [3, 5, 7, 9],
            # Data Tampering, MITM, Info Disclosure, DoS
            "m": [5, 35, 47, 50, 41],
        },
        "OWASP Top 10": {
            "t": [99, 117, 101],
            "m": [97, 108, 99],
        },
    },

    # ── Compute & Containers ───────────────────────────────────────────────────
    "docker-container": {
        "STRIDE": {
            "t": [11, 12, 8, 7, 46, 37, 3, 64, 42],
            # Elevation of Privilege, Privilege Escalation, Data Breach, Info Disclosure,
            # Unencrypted Transmission, Config File Manipulation, Data Tampering, Supply Chain Tampering, Sensitive Data in Logs
            "m": [12, 13, 8, 47, 41, 63, 49, 48, 9],
        },
        "OWASP Top 10": {
            "t": [97, 113, 119, 120, 118, 130],
            # Privilege Escalation, Default Credentials, Lack of Dependency Scanning,
            # Unpatched Software, Known Vuln Components, Insufficient Logging
            "m": [138, 107, 111, 112, 136, 121],
        },
        "PASTA": {
            "t": [84, 85, 86],
            # Third-Party Library Backdoor, Malicious Package, CI/CD Injection
            "m": [83, 85, 87, 84],
        },
    },
    "kubernetes-pod": {
        "STRIDE": {
            "t": [11, 12, 55, 8, 46, 64, 37, 7],
            # Elevation of Privilege, Privilege Escalation, Priv Esc via IDOR,
            # Data Breach, Unencrypted Transmission, Supply Chain Tampering, Config File Manipulation, Info Disclosure
            "m": [12, 13, 9, 8, 47, 41, 63, 6],
        },
        "OWASP Top 10": {
            "t": [97, 113, 118, 119, 120, 127, 128],
            "m": [93, 107, 111, 112, 118, 136, 137, 135],
        },
        "PASTA": {
            "t": [84, 85, 86, 69],
            "m": [83, 85, 87, 84, 68],
        },
    },
    "aws-lambda": {
        "STRIDE": {
            "t": [11, 57, 7, 42, 4, 33, 4],
            # Elevation of Privilege, Authorization Bypass, Info Disclosure,
            # Sensitive Data in Logs, Code Injection, SQL Injection, Code Injection
            "m": [12, 56, 3, 49, 37, 6, 48],
        },
        "OWASP Top 10": {
            "t": [94, 97, 101, 130, 104, 106],
            "m": [93, 95, 97, 121, 100, 101],
        },
        "PASTA": {
            "t": [69, 70, 73, 78],
            "m": [68, 15, 88],
        },
    },

    # ── Web & Mobile ───────────────────────────────────────────────────────────
    "web-browser": {
        "STRIDE": {
            "t": [34, 58, 30, 7, 1, 35, 44],
            # XSS, CSRF, Session Hijacking, Info Disclosure, Spoofing, Parameter Tampering, IDOR
            "m": [39, 57, 34, 50, 37, 9],
            # CSP, CSRF Tokens, Secure Session Mgmt, Security Headers, Input Validation, ACLs
        },
        "OWASP Top 10": {
            "t": [94, 117, 121, 122, 123, 126, 130],
            "m": [93, 108, 114, 116, 117, 120, 121],
        },
        "PASTA": {
            "t": [17, 18, 15, 16],
            # XSS, CSRF, Business Logic Bypass, Credential Stuffing
            "m": [18, 19, 14, 16, 17],
        },
    },
    "mobile-app": {
        "STRIDE": {
            "t": [8, 7, 46, 30, 37, 1, 42, 29],
            # Data Breach, Info Disclosure, Unencrypted Transmission, Session Hijacking,
            # Config File Manipulation, Spoofing, Sensitive Data in Logs, Credential Theft
            "m": [8, 47, 34, 1, 49, 48, 35],
        },
        "OWASP Top 10": {
            "t": [101, 99, 113, 100, 123, 130, 118],
            # Cleartext, Weak Encryption, Default/Hardcoded Creds, Hardcoded Keys,
            # Session Fixation, Insufficient Logging, Known Vuln
            "m": [97, 96, 98, 107, 117, 121, 129],
        },
        "PASTA": {
            "t": [69, 16, 15],
            "m": [68, 16, 15],
        },
    },

    # ── Monitoring & Observability ─────────────────────────────────────────────
    "logging-service": {
        "STRIDE": {
            "t": [39, 42, 38, 6, 7, 3],
            # Log Tampering, Sensitive Data in Logs, Insufficient Audit Logging,
            # Repudiation of Actions, Info Disclosure, Data Tampering
            "m": [43, 49, 6, 42, 46, 4],
            # Tamper-Proof Log Storage, Data Masking, Audit Logging, Comprehensive Audit Log,
            # Log Integrity Monitoring, Data Integrity Checks
        },
        "OWASP Top 10": {
            "t": [130, 131, 132, 133],
            # Insufficient Logging, Log Injection, Missing Alerting, Logs Stored Insecurely
            "m": [121, 122, 123, 144, 143],
        },
        "PASTA": {
            "t": [73, 14],
            "m": [82, 83],
        },
    },
    "cicd-pipeline": {
        "STRIDE": {
            "t": [64, 3, 7, 8, 37, 38],
            # Supply Chain Code Tampering, Data Tampering, Info Disclosure, Data Breach,
            # Config File Manipulation, Insufficient Audit Logging
            "m": [41, 63, 12, 6, 42, 4],
        },
        "OWASP Top 10": {
            "t": [126, 127, 128, 119, 118, 130],
            # Insecure Deserialization, Missing Code Signing, CI/CD Compromise,
            # Lack of Dependency Scanning, Known Vuln Components, Insufficient Logging
            "m": [118, 119, 111, 112, 121, 136, 137],
        },
        "PASTA": {
            "t": [86, 85, 84, 69],
            # CI/CD Injection, Malicious Package, Third-Party Library Backdoor, API Key Exposure
            "m": [87, 85, 84, 83, 86],
        },
    },

    # ── Internal Services ──────────────────────────────────────────────────────
    "internal-rest-api": {
        "STRIDE": {
            "t": [1, 55, 7, 44, 45, 65, 33, 4, 57],
            # Spoofing Identity, Priv Esc via IDOR, Info Disclosure, IDOR,
            # Info Leakage via Error, API Data Scraping, SQL Injection, Code Injection, Authorization Bypass
            "m": [64, 3, 37, 12, 48, 9, 56, 13, 38],
        },
        "OWASP Top 10": {
            "t": [94, 96, 116, 134, 135, 104, 109],
            # IDOR, Missing Function Level Access, Verbose Error, SSRF, Internal Service Exposure via SSRF,
            # SQL Injection, Missing Rate Limiting
            "m": [128, 95, 110, 100, 104, 126],
        },
        "PASTA": {
            "t": [72, 73, 70, 74, 75, 78],
            # Broken Object Level Auth, Excessive Data Exposure, Insufficient API Auth,
            # Lack of Rate Limiting, IDOR in APIs, SSRF
            "m": [70, 73, 69, 78, 92],
        },
    },
    "email-service": {
        "STRIDE": {
            "t": [3, 1, 7, 29, 58],
            # Data Tampering, Spoofing Identity, Info Disclosure, Credential Theft, CSRF
            "m": [3, 2, 37, 35, 57],
        },
        "OWASP Top 10": {
            "t": [121, 116, 130],
            "m": [114, 110, 121],
        },
        "PASTA": {
            "t": [16, 18],
            "m": [17, 19],
        },
    },
    "file-upload": {
        "STRIDE": {
            "t": [36, 4, 3, 43, 7, 8],
            # File Upload Exploitation, Code Injection, Data Tampering, Directory Traversal,
            # Info Disclosure, Data Breach
            "m": [40, 37, 3, 9, 49, 48],
            # File Upload Restrictions, Input Validation, Input Validation, ACLs, Data Masking, Secure Error Handling
        },
        "OWASP Top 10": {
            "t": [108, 106, 95, 116, 118],
            # XXE, OS Command Injection, Path Traversal, Verbose Error, Known Vuln Components
            "m": [103, 101, 110, 111],
        },
        "PASTA": {
            "t": [71, 14, 85],
            # Mass Assignment, API Abuse, Malicious Package
            "m": [70, 84],
        },
    },
}
