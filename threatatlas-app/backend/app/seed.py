"""
Knowledge base seeder — auto-populates frameworks, threats, and mitigations.

Called automatically on application startup via the FastAPI lifespan hook.
Fully idempotent: safe to run multiple times; existing entries are never
modified or duplicated.

Adding a new framework
----------------------
Append a new dict to FRAMEWORKS_REGISTRY following this structure:

    {
        "name":        "My Framework",
        "description": "Short description shown in the UI.",
        "threats": [
            {"name": "...", "description": "...", "category": "..."},
        ],
        "mitigations": [
            {"name": "...", "description": "...", "category": "..."},
        ],
    },

Restart the application (or the Docker service) — seeding runs automatically.
"""

import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Framework, Mitigation, Threat

logger = logging.getLogger(__name__)


# ── Framework registry ────────────────────────────────────────────────────────
# Each entry defines one framework.  Add new frameworks here.

FRAMEWORKS_REGISTRY = [
    # ── STRIDE ────────────────────────────────────────────────────────────────
    {
        "name": "STRIDE",
        "description": (
            "STRIDE Threat Modeling — Spoofing, Tampering, Repudiation, "
            "Information Disclosure, Denial of Service, Elevation of Privilege"
        ),
        "threats": [
            # Spoofing
            {"name": "Credential Theft via Phishing", "category": "Spoofing",
             "description": "Attacker sends phishing emails to steal user credentials by impersonating legitimate services"},
            {"name": "Session Hijacking", "category": "Spoofing",
             "description": "Attacker steals or predicts session tokens to impersonate authenticated users"},
            {"name": "Man-in-the-Middle Attack", "category": "Spoofing",
             "description": "Attacker intercepts communication between client and server to steal credentials or session data"},
            {"name": "IP Spoofing", "category": "Spoofing",
             "description": "Attacker forges source IP address to bypass IP-based authentication or hide identity"},
            {"name": "DNS Spoofing", "category": "Spoofing",
             "description": "Attacker corrupts DNS cache to redirect users to malicious websites"},
            # Tampering
            {"name": "SQL Injection", "category": "Tampering",
             "description": "Attacker injects malicious SQL code through user inputs to manipulate database queries"},
            {"name": "Cross-Site Scripting (XSS)", "category": "Tampering",
             "description": "Attacker injects malicious scripts into web pages viewed by other users"},
            {"name": "Parameter Tampering", "category": "Tampering",
             "description": "Attacker modifies URL parameters, form fields, or cookies to manipulate application behavior"},
            {"name": "Code Injection", "category": "Tampering",
             "description": "Attacker injects malicious code into application to execute arbitrary commands"},
            {"name": "File Upload Exploitation", "category": "Tampering",
             "description": "Attacker uploads malicious files to compromise server or execute code"},
            {"name": "Configuration File Manipulation", "category": "Tampering",
             "description": "Attacker modifies configuration files to alter application behavior or gain elevated privileges"},
            # Repudiation
            {"name": "Insufficient Audit Logging", "category": "Repudiation",
             "description": "Critical actions are not logged, allowing attackers to perform malicious activities without detection"},
            {"name": "Log Tampering", "category": "Repudiation",
             "description": "Attacker modifies or deletes audit logs to hide malicious activities"},
            {"name": "Transaction Denial", "category": "Repudiation",
             "description": "User denies performing a transaction due to lack of non-repudiation controls"},
            {"name": "Clock Manipulation", "category": "Repudiation",
             "description": "Attacker manipulates system time to falsify timestamps in logs and transactions"},
            # Information Disclosure
            {"name": "Sensitive Data Exposure in Logs", "category": "Information Disclosure",
             "description": "Application logs contain sensitive information like passwords, tokens, or PII"},
            {"name": "Directory Traversal", "category": "Information Disclosure",
             "description": "Attacker accesses files outside intended directory by manipulating file paths"},
            {"name": "Insecure Direct Object References", "category": "Information Disclosure",
             "description": "Application exposes internal object references allowing unauthorized access to data"},
            {"name": "Information Leakage via Error Messages", "category": "Information Disclosure",
             "description": "Detailed error messages reveal sensitive system information to attackers"},
            {"name": "Unencrypted Data Transmission", "category": "Information Disclosure",
             "description": "Sensitive data transmitted over network without encryption can be intercepted"},
            {"name": "Metadata Exposure", "category": "Information Disclosure",
             "description": "Application exposes sensitive metadata in HTTP headers, comments, or API responses"},
            {"name": "Memory Dump Exposure", "category": "Information Disclosure",
             "description": "Sensitive data in memory dumps can be accessed by unauthorized users"},
            # Denial of Service
            {"name": "Resource Exhaustion Attack", "category": "Denial of Service",
             "description": "Attacker consumes system resources (CPU, memory, disk) to make service unavailable"},
            {"name": "Application-Layer DDoS", "category": "Denial of Service",
             "description": "Attacker floods application with legitimate-looking requests to overwhelm servers"},
            {"name": "Regex Denial of Service (ReDoS)", "category": "Denial of Service",
             "description": "Attacker exploits inefficient regular expressions to cause catastrophic backtracking"},
            {"name": "Database Connection Pool Exhaustion", "category": "Denial of Service",
             "description": "Attacker opens many database connections until pool is exhausted"},
            {"name": "XML Bomb (Billion Laughs)", "category": "Denial of Service",
             "description": "Attacker sends malicious XML with recursive entity expansion to exhaust memory"},
            {"name": "Slowloris Attack", "category": "Denial of Service",
             "description": "Attacker sends partial HTTP requests slowly to keep connections open and exhaust server"},
            # Elevation of Privilege
            {"name": "Privilege Escalation via IDOR", "category": "Elevation of Privilege",
             "description": "Attacker manipulates object references to access resources belonging to higher-privileged users"},
            {"name": "Authentication Bypass", "category": "Elevation of Privilege",
             "description": "Attacker circumvents authentication mechanisms to gain unauthorized access"},
            {"name": "Authorization Bypass", "category": "Elevation of Privilege",
             "description": "Attacker bypasses authorization checks to access restricted functionality"},
            {"name": "Cross-Site Request Forgery (CSRF)", "category": "Elevation of Privilege",
             "description": "Attacker tricks authenticated user into performing unwanted actions"},
            {"name": "Insecure Deserialization", "category": "Elevation of Privilege",
             "description": "Attacker exploits deserialization to execute arbitrary code or escalate privileges"},
            {"name": "JWT Token Manipulation", "category": "Elevation of Privilege",
             "description": "Attacker modifies JWT claims to escalate privileges or impersonate users"},
            # Additional Spoofing
            {"name": "OAuth Token Theft", "category": "Spoofing",
             "description": "Attacker steals OAuth access or refresh tokens through open redirects, insecure storage, or token leakage in logs"},
            {"name": "SIM Swapping Attack", "category": "Spoofing",
             "description": "Attacker convinces mobile carrier to transfer victim's phone number to attacker-controlled SIM to bypass SMS-based 2FA"},
            # Additional Tampering
            {"name": "AI/ML Model Poisoning", "category": "Tampering",
             "description": "Attacker injects malicious training data to manipulate model behavior or introduce backdoors into ML systems"},
            {"name": "Supply Chain Code Tampering", "category": "Tampering",
             "description": "Attacker modifies source code, build artifacts, or dependencies during the software supply chain process"},
            # Additional Information Disclosure
            {"name": "API Response Data Scraping", "category": "Information Disclosure",
             "description": "Attacker systematically harvests data by repeatedly querying API endpoints without proper rate limiting"},
            {"name": "Side-Channel Information Leakage", "category": "Information Disclosure",
             "description": "Timing differences, error messages, or response sizes reveal sensitive information about internal system state"},
            # Additional Elevation of Privilege
            {"name": "Server-Side Template Injection (SSTI)", "category": "Elevation of Privilege",
             "description": "Attacker injects template directives into server-side templates to execute arbitrary code on the server"},
            {"name": "OAuth Misconfiguration Exploitation", "category": "Elevation of Privilege",
             "description": "Poorly configured OAuth flows allow token leakage, scope escalation, or account takeover via redirect abuse"},
        ],
        "mitigations": [
            # Spoofing
            {"name": "Multi-Factor Authentication (MFA)", "category": "Spoofing",
             "description": "Implement MFA requiring multiple verification factors (password, OTP, biometrics) to prevent credential theft"},
            {"name": "Certificate-Based Authentication", "category": "Spoofing",
             "description": "Use digital certificates for mutual TLS authentication to verify identity of both parties"},
            {"name": "Secure Session Management", "category": "Spoofing",
             "description": "Implement secure session tokens with proper expiration, rotation, and HTTPOnly/Secure flags"},
            {"name": "TLS/SSL Encryption", "category": "Spoofing",
             "description": "Enforce HTTPS with TLS 1.2+ to protect against man-in-the-middle attacks"},
            {"name": "DNSSEC Implementation", "category": "Spoofing",
             "description": "Use DNSSEC to authenticate DNS responses and prevent DNS spoofing"},
            # Tampering
            {"name": "Input Validation and Sanitization", "category": "Tampering",
             "description": "Validate and sanitize all user inputs using allowlists and proper encoding"},
            {"name": "Parameterized Queries", "category": "Tampering",
             "description": "Use prepared statements with parameterized queries to prevent SQL injection"},
            {"name": "Content Security Policy (CSP)", "category": "Tampering",
             "description": "Implement CSP headers to prevent XSS attacks by controlling resource loading"},
            {"name": "Digital Signatures", "category": "Tampering",
             "description": "Use cryptographic signatures to verify data integrity and detect tampering"},
            {"name": "File Upload Restrictions", "category": "Tampering",
             "description": "Implement file type validation, size limits, and virus scanning for uploads"},
            {"name": "Code Signing", "category": "Tampering",
             "description": "Sign application code and verify signatures to prevent code injection"},
            # Repudiation
            {"name": "Comprehensive Audit Logging", "category": "Repudiation",
             "description": "Log all critical operations with timestamps, user identity, and action details"},
            {"name": "Tamper-Proof Log Storage", "category": "Repudiation",
             "description": "Store logs in append-only systems or use blockchain for immutable audit trails"},
            {"name": "Digital Transaction Signatures", "category": "Repudiation",
             "description": "Require cryptographic signatures for critical transactions to ensure non-repudiation"},
            {"name": "Secure Time Synchronization", "category": "Repudiation",
             "description": "Use NTP with authentication to maintain accurate timestamps across systems"},
            {"name": "Log Integrity Monitoring", "category": "Repudiation",
             "description": "Implement SIEM solutions to detect log tampering and unauthorized modifications"},
            # Information Disclosure
            {"name": "Data Encryption at Rest", "category": "Information Disclosure",
             "description": "Encrypt sensitive data stored in databases and file systems using AES-256"},
            {"name": "Data Encryption in Transit", "category": "Information Disclosure",
             "description": "Use TLS/SSL for all data transmission to prevent interception"},
            {"name": "Access Control Lists (ACLs)", "category": "Information Disclosure",
             "description": "Implement fine-grained access controls to restrict data access based on user roles"},
            {"name": "Secure Error Handling", "category": "Information Disclosure",
             "description": "Implement generic error messages for users while logging detailed errors securely"},
            {"name": "Data Masking and Redaction", "category": "Information Disclosure",
             "description": "Mask sensitive data in logs, UI, and API responses to prevent exposure"},
            {"name": "Security Headers", "category": "Information Disclosure",
             "description": "Implement security headers (X-Content-Type-Options, X-Frame-Options, etc.) to prevent information leakage"},
            # Denial of Service
            {"name": "Rate Limiting", "category": "Denial of Service",
             "description": "Implement rate limiting per user/IP to prevent resource exhaustion attacks"},
            {"name": "Web Application Firewall (WAF)", "category": "Denial of Service",
             "description": "Deploy WAF to filter malicious traffic and protect against application-layer attacks"},
            {"name": "Connection Pooling", "category": "Denial of Service",
             "description": "Implement connection pools with proper limits and timeouts to prevent exhaustion"},
            {"name": "Input Size Limits", "category": "Denial of Service",
             "description": "Enforce maximum size limits on requests, uploads, and XML/JSON payloads"},
            {"name": "Auto-Scaling", "category": "Denial of Service",
             "description": "Implement auto-scaling to handle traffic spikes and distribute load"},
            {"name": "Request Timeout Configuration", "category": "Denial of Service",
             "description": "Set appropriate timeouts for connections and requests to prevent slowloris attacks"},
            # Elevation of Privilege
            {"name": "Role-Based Access Control (RBAC)", "category": "Elevation of Privilege",
             "description": "Implement RBAC to ensure users only access resources appropriate for their role"},
            {"name": "Principle of Least Privilege", "category": "Elevation of Privilege",
             "description": "Grant minimum necessary permissions to users and services"},
            {"name": "Authorization Checks", "category": "Elevation of Privilege",
             "description": "Verify user permissions for every protected resource and action"},
            {"name": "CSRF Tokens", "category": "Elevation of Privilege",
             "description": "Implement anti-CSRF tokens for all state-changing operations"},
            {"name": "JWT Signature Verification", "category": "Elevation of Privilege",
             "description": "Verify JWT signatures and validate claims before trusting token data"},
            {"name": "Secure Deserialization", "category": "Elevation of Privilege",
             "description": "Avoid deserializing untrusted data or use safe serialization formats like JSON"},
            # Additional mitigations
            {"name": "OAuth State Parameter Validation", "category": "Spoofing",
             "description": "Enforce state parameter in OAuth flows and validate it on callback to prevent CSRF and open redirect abuse"},
            {"name": "SIM Swap Protection via App-Based MFA", "category": "Spoofing",
             "description": "Use authenticator apps or hardware tokens instead of SMS-based 2FA to resist SIM swapping attacks"},
            {"name": "ML Model Integrity Verification", "category": "Tampering",
             "description": "Hash and sign trained models, validate checksums before deployment to detect poisoning or tampering"},
            {"name": "Software Composition Analysis (SCA)", "category": "Tampering",
             "description": "Scan all dependencies for known vulnerabilities and tampering using SCA tools integrated into CI/CD"},
            {"name": "API Response Schema Validation", "category": "Information Disclosure",
             "description": "Validate outbound API responses against defined schemas to prevent unintentional data field leakage"},
            {"name": "Constant-Time Comparison for Secrets", "category": "Information Disclosure",
             "description": "Use constant-time algorithms for security-sensitive comparisons to prevent timing-based side-channel attacks"},
            {"name": "Template Engine Sandboxing", "category": "Elevation of Privilege",
             "description": "Run template engines in sandboxed environments with restricted access to prevent SSTI code execution"},
            {"name": "OAuth Scope Minimization", "category": "Elevation of Privilege",
             "description": "Request only minimum necessary OAuth scopes and validate scope claims on every API call"},
        ],
    },

    # ── PASTA ─────────────────────────────────────────────────────────────────
    {
        "name": "PASTA",
        "description": (
            "Process for Attack Simulation and Threat Analysis — "
            "a risk-centric threat modeling methodology"
        ),
        "threats": [
            {"name": "API Key Exposure in Client-Side Code", "category": "Asset Analysis",
             "description": "API keys or secrets hardcoded in frontend code can be extracted by attackers"},
            {"name": "Insufficient API Authentication", "category": "Attack Surface Analysis",
             "description": "API endpoints lack proper authentication allowing unauthorized access"},
            {"name": "Mass Assignment Vulnerability", "category": "Attack Modeling",
             "description": "API allows modification of object properties that should be restricted"},
            {"name": "Broken Object Level Authorization", "category": "Threat Analysis",
             "description": "API fails to validate user ownership of resources before allowing access"},
            {"name": "Excessive Data Exposure", "category": "Vulnerability Analysis",
             "description": "API returns more data than necessary, exposing sensitive information"},
            {"name": "Lack of Rate Limiting on Sensitive Operations", "category": "Attack Modeling",
             "description": "No rate limiting on password reset, account creation, or financial transactions"},
            {"name": "Insecure Direct Object References in APIs", "category": "Threat Analysis",
             "description": "Predictable resource IDs allow enumeration and unauthorized access"},
            {"name": "GraphQL Query Depth Attack", "category": "Attack Surface Analysis",
             "description": "Deeply nested GraphQL queries exhaust server resources"},
            {"name": "WebSocket Connection Hijacking", "category": "Attack Modeling",
             "description": "Unprotected WebSocket connections allow message interception or injection"},
            {"name": "Server-Side Request Forgery (SSRF)", "category": "Threat Analysis",
             "description": "Attacker tricks server into making requests to internal systems"},
            # Business Logic Abuse
            {"name": "Price Manipulation Attack", "category": "Business Logic Abuse",
             "description": "Attacker tampers with price parameters in requests to purchase items at unauthorized discounts"},
            {"name": "Workflow Step Bypass", "category": "Business Logic Abuse",
             "description": "Attacker skips mandatory steps in multi-stage processes (e.g., payment verification) by calling later-stage endpoints directly"},
            {"name": "Loyalty Point Fraud", "category": "Business Logic Abuse",
             "description": "Attacker exploits business logic flaws to generate, duplicate, or improperly redeem loyalty points or credits"},
            {"name": "Race Condition Exploitation (TOCTOU)", "category": "Business Logic Abuse",
             "description": "Attacker sends concurrent requests to exploit time-of-check/time-of-use vulnerabilities in transaction logic"},
            {"name": "Account Takeover via Business Logic Flaw", "category": "Business Logic Abuse",
             "description": "Attacker abuses password reset, account merge, or referral features to take over legitimate accounts"},
            # Supply Chain Risk
            {"name": "Third-Party Library Backdoor", "category": "Supply Chain Risk",
             "description": "Malicious code introduced through a compromised open-source library or package dependency"},
            {"name": "Malicious Package Substitution (Typosquatting)", "category": "Supply Chain Risk",
             "description": "Attacker publishes a package with a similar name to a legitimate one to inject malicious code into build pipelines"},
            {"name": "CI/CD Pipeline Injection", "category": "Supply Chain Risk",
             "description": "Attacker gains access to CI/CD pipeline to inject malicious code during the build or deployment process"},
            # Third-Party Integration
            {"name": "OAuth Provider Misconfiguration", "category": "Third-Party Integration",
             "description": "Insecure OAuth setup with third-party provider allows token leakage or unauthorized access to user data"},
            {"name": "Webhook Injection Attack", "category": "Third-Party Integration",
             "description": "Attacker forges or replays webhook payloads to trigger unauthorized actions in the application"},
            {"name": "Third-Party API Credential Abuse", "category": "Third-Party Integration",
             "description": "Compromised or overly permissive third-party API credentials allow attackers to abuse integrated services"},
            # API Versioning
            {"name": "Deprecated API Version Exploitation", "category": "API Versioning",
             "description": "Attacker targets old API versions still accessible but no longer maintained or patched"},
            {"name": "Shadow API Endpoint Discovery", "category": "API Versioning",
             "description": "Undocumented or forgotten API endpoints discovered and exploited to bypass security controls"},
            {"name": "API Parameter Pollution", "category": "API Versioning",
             "description": "Attacker sends duplicate parameters to confuse server-side parsing and bypass input validation logic"},
            {"name": "Versioning-Based Authentication Bypass", "category": "API Versioning",
             "description": "Newer authentication requirements not backported to old API versions, allowing bypass via version downgrade"},
        ],
        "mitigations": [
            {"name": "Environment Variable Management", "category": "Asset Analysis",
             "description": "Store secrets in environment variables or secret management systems, never in code"},
            {"name": "API Gateway with Authentication", "category": "Attack Surface Analysis",
             "description": "Implement API gateway with OAuth2/JWT authentication for all endpoints"},
            {"name": "DTO Validation and Whitelisting", "category": "Attack Modeling",
             "description": "Use Data Transfer Objects with explicit property whitelisting to prevent mass assignment"},
            {"name": "Object-Level Authorization Checks", "category": "Threat Analysis",
             "description": "Verify user ownership before allowing access to any resource"},
            {"name": "Response Filtering", "category": "Vulnerability Analysis",
             "description": "Filter API responses to return only necessary fields using DTOs or GraphQL field selection"},
            {"name": "Distributed Rate Limiting", "category": "Attack Modeling",
             "description": "Implement Redis-based distributed rate limiting across all API instances"},
            {"name": "UUID-Based Resource Identifiers", "category": "Threat Analysis",
             "description": "Use UUIDs instead of sequential IDs to prevent enumeration attacks"},
            {"name": "GraphQL Query Complexity Analysis", "category": "Attack Surface Analysis",
             "description": "Implement query depth and complexity limits for GraphQL endpoints"},
            {"name": "WebSocket Authentication and Validation", "category": "Attack Modeling",
             "description": "Authenticate WebSocket connections and validate all messages"},
            {"name": "SSRF Protection with URL Validation", "category": "Threat Analysis",
             "description": "Validate and whitelist allowed URLs, disable URL redirects, and use internal DNS filtering"},
            # Business Logic Abuse mitigations
            {"name": "Server-Side Business Rule Enforcement", "category": "Business Logic Abuse",
             "description": "Validate all business rules on the server side; never trust client-supplied price, discount, or workflow state values"},
            {"name": "Idempotency Keys for Transactions", "category": "Business Logic Abuse",
             "description": "Require unique idempotency keys for financial and state-changing operations to prevent duplicate processing"},
            {"name": "Optimistic Locking for Race Conditions", "category": "Business Logic Abuse",
             "description": "Use database-level optimistic locking or atomic operations to prevent race condition exploitation"},
            {"name": "Anti-Automation Controls", "category": "Business Logic Abuse",
             "description": "Detect and block automated abuse of business workflows using behavioral analysis and CAPTCHA"},
            {"name": "Transaction Anomaly Monitoring", "category": "Business Logic Abuse",
             "description": "Monitor transactions for anomalies such as unusual discounts, loyalty point spikes, or workflow skips"},
            # Supply Chain Risk mitigations
            {"name": "Software Bill of Materials (SBOM)", "category": "Supply Chain Risk",
             "description": "Generate and maintain SBOM for all applications to track component provenance and respond to new CVEs"},
            {"name": "Package Signature Verification", "category": "Supply Chain Risk",
             "description": "Verify cryptographic signatures of all packages before installation using Sigstore or GPG"},
            {"name": "Dependency Pinning with Hash Verification", "category": "Supply Chain Risk",
             "description": "Pin all dependencies to exact versions with hash verification to prevent unexpected or malicious updates"},
            {"name": "Private Package Registry", "category": "Supply Chain Risk",
             "description": "Use private package registries with vetting processes to prevent malicious package substitution attacks"},
            {"name": "CI/CD Pipeline Security Hardening", "category": "Supply Chain Risk",
             "description": "Restrict pipeline permissions, require code review for workflow changes, and audit all pipeline modifications"},
            # Third-Party Integration mitigations
            {"name": "OAuth Scope Restriction for Third Parties", "category": "Third-Party Integration",
             "description": "Request minimal OAuth scopes from third-party providers and validate scopes on every token use"},
            {"name": "Webhook Signature Verification", "category": "Third-Party Integration",
             "description": "Validate HMAC signatures on all incoming webhook payloads to prevent forgery and replay attacks"},
            {"name": "Third-Party API Least Privilege", "category": "Third-Party Integration",
             "description": "Grant third-party integrations only the minimum permissions needed and rotate credentials regularly"},
            # API Versioning mitigations
            {"name": "API Version Lifecycle Management", "category": "API Versioning",
             "description": "Define deprecation timelines, enforce sunset dates, and block access to end-of-life API versions"},
            {"name": "API Inventory and Shadow Endpoint Discovery", "category": "API Versioning",
             "description": "Maintain complete API inventory, remove shadow endpoints, and enforce gateway routing for all APIs"},
        ],
    },

    # ── OWASP Top 10 ──────────────────────────────────────────────────────────
    {
        "name": "OWASP Top 10",
        "description": (
            "OWASP Top 10 Web Application Security Risks — "
            "industry standard awareness document for web application security"
        ),
        "threats": [
            # A01 — Broken Access Control
            {"name": "Insecure Direct Object References (IDOR)", "category": "Broken Access Control",
             "description": "Application exposes references to internal objects allowing attackers to access unauthorized data by modifying parameters"},
            {"name": "Path Traversal Attack", "category": "Broken Access Control",
             "description": "Attacker accesses files and directories outside the web root by manipulating file path variables"},
            {"name": "Missing Function Level Access Control", "category": "Broken Access Control",
             "description": "Application doesn't properly verify user permissions for administrative or privileged functions"},
            {"name": "Privilege Escalation", "category": "Broken Access Control",
             "description": "User gains elevated privileges beyond their authorization level through exploitation of access control flaws"},
            {"name": "Forced Browsing", "category": "Broken Access Control",
             "description": "Attacker accesses restricted pages or resources by directly requesting URLs without proper authorization checks"},
            # A02 — Cryptographic Failures
            {"name": "Weak Encryption Algorithm Usage", "category": "Cryptographic Failures",
             "description": "Application uses outdated or weak cryptographic algorithms (MD5, SHA1, DES) that can be easily broken"},
            {"name": "Hardcoded Cryptographic Keys", "category": "Cryptographic Failures",
             "description": "Encryption keys are embedded in source code or configuration files, making them easily discoverable"},
            {"name": "Transmission of Sensitive Data in Cleartext", "category": "Cryptographic Failures",
             "description": "Passwords, credit cards, or personal data transmitted without encryption over HTTP or unencrypted channels"},
            {"name": "Insufficient SSL/TLS Configuration", "category": "Cryptographic Failures",
             "description": "Weak TLS versions (1.0/1.1) or cipher suites enabled, allowing downgrade attacks"},
            {"name": "Missing Certificate Validation", "category": "Cryptographic Failures",
             "description": "Application doesn't properly validate SSL/TLS certificates, enabling man-in-the-middle attacks"},
            # A03 — Injection
            {"name": "SQL Injection", "category": "Injection",
             "description": "Attacker injects malicious SQL commands through user input to manipulate database queries and access unauthorized data"},
            {"name": "NoSQL Injection", "category": "Injection",
             "description": "Malicious queries injected into NoSQL databases (MongoDB, CouchDB) through unvalidated user input"},
            {"name": "OS Command Injection", "category": "Injection",
             "description": "Attacker executes arbitrary system commands on the server by injecting shell commands through application inputs"},
            {"name": "LDAP Injection", "category": "Injection",
             "description": "Malicious LDAP statements injected to manipulate directory service queries and bypass authentication"},
            {"name": "XML External Entity (XXE) Injection", "category": "Injection",
             "description": "Attacker injects malicious XML entities to access local files, perform SSRF, or cause denial of service"},
            # A04 — Insecure Design
            {"name": "Missing Rate Limiting", "category": "Insecure Design",
             "description": "Application lacks throttling mechanisms allowing brute force attacks and resource exhaustion"},
            {"name": "Trust Boundary Violation", "category": "Insecure Design",
             "description": "Application doesn't properly validate data crossing trust boundaries between components"},
            {"name": "Insufficient Workflow Validation", "category": "Insecure Design",
             "description": "Business logic flaws allow users to skip steps or manipulate multi-step processes"},
            {"name": "Missing Security Requirements", "category": "Insecure Design",
             "description": "Security controls not defined during design phase leading to fundamental architecture vulnerabilities"},
            # A05 — Security Misconfiguration
            {"name": "Default Credentials in Production", "category": "Security Misconfiguration",
             "description": "Default usernames and passwords not changed on production systems allowing easy unauthorized access"},
            {"name": "Unnecessary Features Enabled", "category": "Security Misconfiguration",
             "description": "Unused services, pages, accounts, or privileges enabled increasing attack surface"},
            {"name": "Directory Listing Enabled", "category": "Security Misconfiguration",
             "description": "Web server configured to show directory contents exposing sensitive files and application structure"},
            {"name": "Verbose Error Messages", "category": "Security Misconfiguration",
             "description": "Detailed error messages expose stack traces, database queries, or system information to attackers"},
            {"name": "Missing Security Headers", "category": "Security Misconfiguration",
             "description": "HTTP security headers (CSP, X-Frame-Options, HSTS) not configured leaving application vulnerable to attacks"},
            # A06 — Vulnerable and Outdated Components
            {"name": "Use of Components with Known Vulnerabilities", "category": "Vulnerable Components",
             "description": "Application uses outdated libraries, frameworks, or dependencies with publicly known security flaws"},
            {"name": "Lack of Dependency Scanning", "category": "Vulnerable Components",
             "description": "No automated scanning for vulnerable dependencies allowing outdated components to remain undetected"},
            {"name": "Unpatched Software", "category": "Vulnerable Components",
             "description": "Operating system, web server, or application server not regularly updated with security patches"},
            # A07 — Identification and Authentication Failures
            {"name": "Weak Password Policy", "category": "Authentication Failures",
             "description": "Application allows weak passwords without complexity requirements enabling brute force attacks"},
            {"name": "Missing Multi-Factor Authentication", "category": "Authentication Failures",
             "description": "Critical functions accessible with only password authentication making accounts vulnerable to credential theft"},
            {"name": "Session Fixation", "category": "Authentication Failures",
             "description": "Application doesn't regenerate session IDs after login allowing attackers to hijack authenticated sessions"},
            {"name": "Credential Stuffing Vulnerability", "category": "Authentication Failures",
             "description": "No protection against automated credential stuffing attacks using leaked password databases"},
            {"name": "Insecure Password Recovery", "category": "Authentication Failures",
             "description": "Password reset mechanism uses predictable tokens or security questions allowing account takeover"},
            # A08 — Software and Data Integrity Failures
            {"name": "Insecure Deserialization", "category": "Integrity Failures",
             "description": "Application deserializes untrusted data allowing remote code execution or privilege escalation"},
            {"name": "Missing Code Signing", "category": "Integrity Failures",
             "description": "Software updates not digitally signed allowing malicious code injection through compromised update mechanisms"},
            {"name": "CI/CD Pipeline Compromise", "category": "Integrity Failures",
             "description": "Insecure build pipeline allows attackers to inject malicious code during development or deployment"},
            {"name": "Lack of Integrity Verification", "category": "Integrity Failures",
             "description": "Application doesn't verify integrity of critical data or code allowing tampering to go undetected"},
            # A09 — Security Logging and Monitoring Failures
            {"name": "Insufficient Logging", "category": "Logging Failures",
             "description": "Security events (failed logins, access violations) not logged preventing detection of attacks"},
            {"name": "Log Injection", "category": "Logging Failures",
             "description": "User input logged without sanitization allowing attackers to forge log entries or inject malicious content"},
            {"name": "Missing Alerting for Critical Events", "category": "Logging Failures",
             "description": "No real-time alerts for suspicious activities delaying incident response"},
            {"name": "Logs Stored Insecurely", "category": "Logging Failures",
             "description": "Log files accessible to unauthorized users or stored without encryption exposing sensitive data"},
            # A10 — Server-Side Request Forgery
            {"name": "Server-Side Request Forgery", "category": "SSRF",
             "description": "Application fetches remote resources based on user input without validation, allowing access to internal systems"},
            {"name": "Internal Service Exposure via SSRF", "category": "SSRF",
             "description": "SSRF vulnerability allows scanning and accessing internal services not exposed to internet"},
            {"name": "Cloud Metadata Service Abuse", "category": "SSRF",
             "description": "SSRF used to access cloud metadata endpoints exposing credentials and configuration"},
        ],
        "mitigations": [
            {"name": "Implement Role-Based Access Control (RBAC)", "category": "Access Control",
             "description": "Define user roles and enforce permissions at every access point with deny-by-default principle"},
            {"name": "Use Indirect Object References", "category": "Access Control",
             "description": "Map direct object references to user-specific session data preventing unauthorized access"},
            {"name": "Enforce Access Control at API Layer", "category": "Access Control",
             "description": "Verify authorization for every API endpoint and resource access preventing privilege escalation"},
            {"name": "Use Strong Encryption Algorithms", "category": "Cryptography",
             "description": "Implement AES-256 for encryption and SHA-256 or better for hashing, avoid deprecated algorithms"},
            {"name": "Implement TLS 1.2+ with Strong Ciphers", "category": "Cryptography",
             "description": "Configure TLS 1.2 or 1.3 only with strong cipher suites, disable weak protocols"},
            {"name": "Use Key Management System (KMS)", "category": "Cryptography",
             "description": "Store encryption keys in dedicated KMS or hardware security modules, rotate regularly"},
            {"name": "Enforce HTTPS Everywhere", "category": "Cryptography",
             "description": "Redirect all HTTP traffic to HTTPS and implement HSTS header to prevent downgrade attacks"},
            {"name": "Use Parameterized Queries", "category": "Input Validation",
             "description": "Always use prepared statements with parameter binding for database queries preventing SQL injection"},
            {"name": "Input Validation and Sanitization", "category": "Input Validation",
             "description": "Validate all user input against whitelist patterns and sanitize before processing"},
            {"name": "Use ORM Frameworks Securely", "category": "Input Validation",
             "description": "Leverage ORM frameworks with parameterized queries, avoid raw SQL construction"},
            {"name": "Disable XML External Entity Processing", "category": "Input Validation",
             "description": "Configure XML parsers to disable external entity resolution preventing XXE attacks"},
            {"name": "Implement Rate Limiting", "category": "Secure Design",
             "description": "Apply throttling on authentication, API endpoints, and resource-intensive operations"},
            {"name": "Use Threat Modeling", "category": "Secure Design",
             "description": "Conduct threat modeling during design phase to identify and address security risks early"},
            {"name": "Implement Defense in Depth", "category": "Secure Design",
             "description": "Layer multiple security controls so failure of one doesn't compromise entire system"},
            {"name": "Harden Default Configurations", "category": "Configuration",
             "description": "Change all default credentials, disable unnecessary features, and follow security hardening guides"},
            {"name": "Implement Security Headers", "category": "Configuration",
             "description": "Configure CSP, X-Frame-Options, X-Content-Type-Options, HSTS, and other security headers"},
            {"name": "Disable Directory Listing", "category": "Configuration",
             "description": "Configure web server to prevent directory browsing and hide application structure"},
            {"name": "Use Custom Error Pages", "category": "Configuration",
             "description": "Display generic error messages to users while logging detailed errors securely"},
            {"name": "Implement Dependency Scanning", "category": "Supply Chain",
             "description": "Use automated tools (Snyk, Dependabot) to scan and alert on vulnerable dependencies"},
            {"name": "Establish Patch Management Process", "category": "Supply Chain",
             "description": "Regularly update all components and have process for emergency patching of critical vulnerabilities"},
            {"name": "Remove Unused Dependencies", "category": "Supply Chain",
             "description": "Regularly audit and remove unused libraries and components reducing attack surface"},
            {"name": "Implement Multi-Factor Authentication (MFA)", "category": "Authentication",
             "description": "Require MFA for all users, especially for administrative and sensitive operations"},
            {"name": "Enforce Strong Password Policy", "category": "Authentication",
             "description": "Require minimum 12 characters, complexity requirements, and check against breached password databases"},
            {"name": "Implement Account Lockout", "category": "Authentication",
             "description": "Lock accounts after failed login attempts with exponential backoff to prevent brute force"},
            {"name": "Regenerate Session IDs After Login", "category": "Authentication",
             "description": "Create new session ID upon authentication to prevent session fixation attacks"},
            {"name": "Implement Code Signing", "category": "Integrity",
             "description": "Digitally sign all software releases and verify signatures before deployment"},
            {"name": "Secure CI/CD Pipeline", "category": "Integrity",
             "description": "Harden build servers, require code review, and scan for vulnerabilities in pipeline"},
            {"name": "Avoid Unsafe Deserialization", "category": "Integrity",
             "description": "Use safe serialization formats (JSON) and validate deserialized data against schema"},
            {"name": "Implement Comprehensive Logging", "category": "Monitoring",
             "description": "Log all security events including authentication, authorization failures, and input validation errors"},
            {"name": "Centralize Log Management", "category": "Monitoring",
             "description": "Send logs to centralized SIEM system for correlation and long-term retention"},
            {"name": "Implement Real-Time Alerting", "category": "Monitoring",
             "description": "Configure alerts for suspicious patterns like multiple failed logins or privilege escalation attempts"},
            {"name": "Validate and Sanitize URLs", "category": "Input Validation",
             "description": "Whitelist allowed domains and protocols, validate URLs before making requests"},
            {"name": "Disable URL Redirects in Requests", "category": "Input Validation",
             "description": "Configure HTTP clients to not follow redirects automatically preventing SSRF bypass"},
            {"name": "Use Network Segmentation", "category": "Network Security",
             "description": "Isolate application servers from internal networks and restrict outbound connections"},
            # Additional mitigations
            {"name": "JWT Claims Validation", "category": "Access Control",
             "description": "Validate all JWT claims (iss, aud, exp, nbf) and verify signature algorithm matches expected type"},
            {"name": "Object-Level Authorization Enforcement", "category": "Access Control",
             "description": "Check user ownership of every resource at the object level before returning or modifying data"},
            {"name": "Certificate Pinning", "category": "Cryptography",
             "description": "Pin TLS certificates in mobile and thick clients to prevent interception with rogue certificates"},
            {"name": "Secrets Rotation Automation", "category": "Cryptography",
             "description": "Automate rotation of API keys, passwords, and certificates using vault systems on defined schedules"},
            {"name": "Encrypt Backup Data", "category": "Cryptography",
             "description": "Apply the same encryption standards to backups as production data and store keys separately"},
            {"name": "Template Injection Prevention", "category": "Input Validation",
             "description": "Treat template directives as untrusted input; use logic-less templates or strict sandboxing"},
            {"name": "HTTP Header Injection Prevention", "category": "Input Validation",
             "description": "Strip newline characters from user-supplied header values to prevent response splitting attacks"},
            {"name": "GraphQL Query Depth and Complexity Limiting", "category": "Input Validation",
             "description": "Limit GraphQL query depth and complexity score to prevent resource exhaustion through nested queries"},
            {"name": "Cloud Security Posture Management (CSPM)", "category": "Configuration",
             "description": "Continuously scan cloud configurations for misconfigurations and compliance violations"},
            {"name": "Container Image Scanning in CI/CD", "category": "Configuration",
             "description": "Scan container images for vulnerabilities and misconfigurations before deployment"},
            {"name": "Infrastructure as Code Security Scanning", "category": "Configuration",
             "description": "Scan IaC templates (Terraform, CloudFormation) for security issues before provisioning"},
            {"name": "Container Base Image Hardening", "category": "Supply Chain",
             "description": "Use minimal base images (distroless), remove unnecessary tools, and run containers as non-root"},
            {"name": "Credential Breach Monitoring", "category": "Authentication",
             "description": "Check user credentials against known breach databases (HaveIBeenPwned) on login and registration"},
            {"name": "Adaptive Authentication", "category": "Authentication",
             "description": "Apply additional authentication challenges based on risk signals like new device or unusual location"},
            {"name": "Subresource Integrity (SRI)", "category": "Integrity",
             "description": "Add integrity hashes to third-party script and stylesheet tags to prevent tampering via CDN"},
            {"name": "Package Lock File Enforcement", "category": "Integrity",
             "description": "Commit and enforce lock files in CI/CD to ensure reproducible builds with verified dependency versions"},
            {"name": "Structured Log Format with Correlation IDs", "category": "Monitoring",
             "description": "Use structured logging with request correlation IDs to trace attacks and incidents across services"},
            {"name": "Immutable Log Storage", "category": "Monitoring",
             "description": "Write logs to append-only storage (WORM) to prevent tampering and ensure forensic integrity"},
            {"name": "Distributed Tracing Integration", "category": "Monitoring",
             "description": "Integrate distributed tracing (OpenTelemetry) to track requests across microservices for security analysis"},
        ],
    },

    # ── LINDDUN ───────────────────────────────────────────────────────────────
    {
        "name": "LINDDUN",
        "description": (
            "LINDDUN Privacy Threat Modeling — Linkability, Identifiability, "
            "Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance"
        ),
        "threats": [
            # Linkability
            {"name": "User Activity Tracking Across Sessions", "category": "Linkability",
             "description": "Attacker correlates user activities across different sessions using persistent identifiers or browser fingerprinting"},
            {"name": "Cross-Site Tracking via Third-Party Cookies", "category": "Linkability",
             "description": "Third-party cookies and trackers link user behavior across multiple websites creating detailed profiles"},
            {"name": "Location Data Correlation", "category": "Linkability",
             "description": "GPS, IP address, or Wi-Fi data linked across time to track user movements and patterns"},
            {"name": "Device Fingerprinting", "category": "Linkability",
             "description": "Browser and device characteristics collected to create unique fingerprint enabling cross-session tracking"},
            # Identifiability
            {"name": "Username Enumeration", "category": "Identifiability",
             "description": "Application reveals whether usernames or email addresses exist through different error messages or timing attacks"},
            {"name": "PII Exposure in URLs", "category": "Identifiability",
             "description": "Personally identifiable information included in URLs visible in browser history, logs, and referrer headers"},
            {"name": "Metadata Exposure in Files", "category": "Identifiability",
             "description": "Uploaded files contain metadata (author, location, device info) revealing user identity"},
            {"name": "Re-identification via Data Aggregation", "category": "Identifiability",
             "description": "Combining supposedly anonymous data points allows identification of individuals"},
            # Non-repudiation
            {"name": "Insufficient Audit Logging", "category": "Non-repudiation",
             "description": "User actions not properly logged allowing users to deny performing sensitive operations"},
            {"name": "Missing Digital Signatures", "category": "Non-repudiation",
             "description": "Transactions lack cryptographic signatures allowing users to claim they didn't authorize actions"},
            {"name": "Shared Account Usage", "category": "Non-repudiation",
             "description": "Multiple users sharing single account preventing attribution of specific actions to individuals"},
            # Detectability
            {"name": "Social Media Presence Linkage", "category": "Detectability",
             "description": "User profiles linkable to social media accounts revealing additional personal information"},
            {"name": "Public Data Aggregation", "category": "Detectability",
             "description": "Publicly accessible user data aggregated to build comprehensive profiles without consent"},
            {"name": "Pattern Analysis Revealing Behavior", "category": "Detectability",
             "description": "Analysis of usage patterns reveals sensitive information about user behavior and preferences"},
            # Disclosure of Information
            {"name": "Insufficient Data Anonymization", "category": "Disclosure",
             "description": "Personal data not properly anonymized before sharing with third parties or for analytics"},
            {"name": "Excessive Data Collection", "category": "Disclosure",
             "description": "Application collects more personal data than necessary for stated purposes"},
            {"name": "Insecure Data Sharing with Third Parties", "category": "Disclosure",
             "description": "Personal data shared with partners or vendors without proper security controls or user consent"},
            {"name": "Data Breach via Database Exposure", "category": "Disclosure",
             "description": "Personal data exposed through database vulnerabilities or misconfigurations"},
            {"name": "Sensitive Data in Client-Side Code", "category": "Disclosure",
             "description": "Personal or sensitive information embedded in JavaScript or HTML accessible to anyone"},
            # Unawareness
            {"name": "Unclear Privacy Policy", "category": "Unawareness",
             "description": "Privacy policy written in complex legal language preventing users from understanding data practices"},
            {"name": "Hidden Data Collection", "category": "Unawareness",
             "description": "Application collects data without informing users or obtaining consent"},
            {"name": "Lack of Data Access Controls", "category": "Unawareness",
             "description": "Users cannot view, export, or delete their personal data as required by privacy regulations"},
            {"name": "Missing Privacy-Enhancing Features", "category": "Unawareness",
             "description": "No options for users to limit data collection or control privacy settings"},
            # Non-compliance
            {"name": "GDPR Violation - Missing Legal Basis", "category": "Non-compliance",
             "description": "Personal data processed without valid legal basis (consent, contract, legitimate interest)"},
            {"name": "GDPR Violation - Data Retention", "category": "Non-compliance",
             "description": "Personal data retained longer than necessary violating data minimization principle"},
            {"name": "CCPA Violation - Consumer Rights", "category": "Non-compliance",
             "description": "Application doesn't provide required mechanisms for users to exercise CCPA rights"},
            {"name": "Missing Data Protection Impact Assessment", "category": "Non-compliance",
             "description": "High-risk processing activities conducted without required DPIA under GDPR"},
            {"name": "International Data Transfer Violation", "category": "Non-compliance",
             "description": "Personal data transferred internationally without adequate safeguards (SCCs, BCRs)"},
        ],
        "mitigations": [
            {"name": "Implement Cookie Consent Management", "category": "Privacy Controls",
             "description": "Use consent management platform to control tracking cookies and respect user privacy choices"},
            {"name": "Rotate Session Identifiers", "category": "Privacy Controls",
             "description": "Regularly rotate session IDs and use short-lived tokens to prevent long-term tracking"},
            {"name": "Block Third-Party Trackers", "category": "Privacy Controls",
             "description": "Implement Content Security Policy to block third-party tracking scripts and analytics"},
            {"name": "Minimize Browser Fingerprinting", "category": "Privacy Controls",
             "description": "Reduce uniqueness of browser characteristics and randomize canvas fingerprints"},
            {"name": "Use Generic Error Messages", "category": "Data Protection",
             "description": "Return same error message for all authentication failures preventing username enumeration"},
            {"name": "Strip Metadata from Files", "category": "Data Protection",
             "description": "Remove EXIF and metadata from user-uploaded files before storage or display"},
            {"name": "Implement k-Anonymity", "category": "Data Protection",
             "description": "Ensure data releases maintain k-anonymity preventing re-identification of individuals"},
            {"name": "Use Pseudonymization", "category": "Data Protection",
             "description": "Replace direct identifiers with pseudonyms making data attribution impossible without additional information"},
            {"name": "Implement Comprehensive Audit Trails", "category": "Accountability",
             "description": "Log all user actions with timestamps and digital signatures for accountability"},
            {"name": "Use Digital Signatures for Transactions", "category": "Accountability",
             "description": "Require cryptographic signatures for sensitive operations providing proof of authorization"},
            {"name": "Enforce Individual User Accounts", "category": "Accountability",
             "description": "Prohibit account sharing and require unique credentials for each user"},
            {"name": "Implement Access Controls on Profiles", "category": "Privacy Controls",
             "description": "Allow users to control visibility of profile information and limit public data exposure"},
            {"name": "Provide Privacy Settings Dashboard", "category": "Privacy Controls",
             "description": "Give users granular control over what data is public, shared, or private"},
            {"name": "Use Differential Privacy", "category": "Data Protection",
             "description": "Add statistical noise to aggregated data preventing individual pattern detection"},
            {"name": "Implement Data Minimization", "category": "Data Protection",
             "description": "Collect only data essential for stated purposes and delete when no longer needed"},
            {"name": "Encrypt Personal Data at Rest", "category": "Data Protection",
             "description": "Use AES-256 encryption for all stored personal data with proper key management"},
            {"name": "Use Data Processing Agreements", "category": "Compliance",
             "description": "Establish formal DPAs with all data processors ensuring GDPR compliance"},
            {"name": "Implement Purpose Limitation", "category": "Compliance",
             "description": "Use data only for explicitly stated purposes and obtain new consent for new uses"},
            {"name": "Provide Clear Privacy Notices", "category": "Transparency",
             "description": "Write privacy policy in plain language explaining data collection, use, and rights"},
            {"name": "Implement Just-in-Time Notices", "category": "Transparency",
             "description": "Show privacy notices at point of data collection explaining why data is needed"},
            {"name": "Build User Data Dashboard", "category": "Transparency",
             "description": "Allow users to view all collected data, download it, and request deletion"},
            {"name": "Provide Privacy-Enhancing Settings", "category": "Privacy Controls",
             "description": "Offer privacy modes, anonymous browsing, and data collection opt-outs"},
            {"name": "Conduct Data Protection Impact Assessment", "category": "Compliance",
             "description": "Perform DPIA for high-risk processing activities as required by GDPR Article 35"},
            {"name": "Implement Standard Contractual Clauses", "category": "Compliance",
             "description": "Use SCCs for international data transfers ensuring adequate data protection"},
            {"name": "Establish Data Retention Policies", "category": "Compliance",
             "description": "Define and enforce retention periods for different data types with automated deletion"},
            {"name": "Appoint Data Protection Officer", "category": "Compliance",
             "description": "Designate DPO responsible for GDPR compliance and data protection strategy"},
            {"name": "Implement Consent Management", "category": "Compliance",
             "description": "Build system to obtain, record, and respect user consent for data processing"},
        ],
    },
    # ── DREAD ─────────────────────────────────────────────────────────────────
    {
        "name": "DREAD",
        "description": (
            "DREAD Risk Rating — Damage, Reproducibility, Exploitability, "
            "Affected users, Discoverability. Scoring framework for prioritizing threats."
        ),
        "threats": [
            {"name": "High Damage Potential", "category": "Damage",
             "description": "Threat that causes severe data loss, full system compromise, or significant financial harm when realized"},
            {"name": "Easy Reproducibility", "category": "Reproducibility",
             "description": "Attack can be reproduced reliably with a documented script or public tool, lowering the attacker skill bar"},
            {"name": "Low Exploit Complexity", "category": "Exploitability",
             "description": "Exploitation requires minimal skill, no authentication, and no special access — e.g. a remote unauthenticated RCE"},
            {"name": "Broad User Impact", "category": "Affected Users",
             "description": "Successful exploit affects all users of the system rather than a small subset"},
            {"name": "High Discoverability", "category": "Discoverability",
             "description": "Vulnerability is trivially visible to anyone probing the system, e.g. exposed in the UI, error messages, or public CVE"},
        ],
        "mitigations": [
            {"name": "Reduce Damage via Blast-Radius Controls", "category": "Damage",
             "description": "Apply least-privilege, tenant isolation, and data partitioning so a single compromise cannot impact all data"},
            {"name": "Break Attack Reproducibility", "category": "Reproducibility",
             "description": "Introduce non-determinism (rate limits, token freshness, session binding) that breaks scripted exploits"},
            {"name": "Raise Exploitation Complexity", "category": "Exploitability",
             "description": "Add defense-in-depth layers: strong authN, WAF, input validation, runtime protections (ASLR, DEP)"},
            {"name": "Limit User Exposure", "category": "Affected Users",
             "description": "Use feature flags, canary releases, and scoped rollouts to contain impact during the window before a fix"},
            {"name": "Reduce Discoverability", "category": "Discoverability",
             "description": "Strip version banners, generic error messages, avoid predictable URLs, mature responsible-disclosure program"},
        ],
    },
    # ── VAST ─────────────────────────────────────────────────────────────────
    {
        "name": "VAST",
        "description": (
            "Visual, Agile, and Simple Threat modeling — application and operational "
            "threat models designed to scale in DevOps pipelines."
        ),
        "threats": [
            {"name": "Unauthenticated API Access", "category": "Application Threat",
             "description": "Public API endpoint exposes data or actions without requiring authentication"},
            {"name": "Weak Service-to-Service Authentication", "category": "Application Threat",
             "description": "Internal microservices trust network position instead of verifying caller identity (no mTLS or service tokens)"},
            {"name": "Insecure Third-Party Integration", "category": "Application Threat",
             "description": "External SaaS/API trusted without contract validation, signature checks, or rate limiting"},
            {"name": "Shared Infrastructure Compromise", "category": "Operational Threat",
             "description": "Multi-tenant cluster or DB breached via noisy-neighbor side channel or escape"},
            {"name": "CI/CD Pipeline Poisoning", "category": "Operational Threat",
             "description": "Malicious commit, dependency, or pipeline step injects code into production builds"},
            {"name": "Secrets Leakage in Logs/Artifacts", "category": "Operational Threat",
             "description": "Credentials, tokens, or private keys leaked through logs, build artifacts, or container images"},
            {"name": "Unmonitored Configuration Drift", "category": "Operational Threat",
             "description": "Production config diverges from source-of-truth, introducing undocumented attack surface"},
            {"name": "Dependency Confusion / Typosquatting", "category": "Application Threat",
             "description": "Attacker publishes malicious package with similar name to internal dependency, gets pulled by build"},
        ],
        "mitigations": [
            {"name": "Enforce AuthN on All API Endpoints", "category": "Application Mitigation",
             "description": "Default-deny posture, gateway-enforced authentication, document and review every anonymous route"},
            {"name": "Implement Mutual TLS Between Services", "category": "Application Mitigation",
             "description": "mTLS or SPIFFE/SPIRE for service-to-service identity; do not rely on network topology for trust"},
            {"name": "Vet and Sandbox Third-Party Integrations", "category": "Application Mitigation",
             "description": "Contractual SLAs, signed webhooks, outbound network policies, and circuit breakers on external calls"},
            {"name": "Harden Multi-Tenant Isolation", "category": "Operational Mitigation",
             "description": "Namespace/pool-level isolation, row-level security, seccomp/AppArmor profiles on shared runtimes"},
            {"name": "Sign and Verify Build Artifacts", "category": "Operational Mitigation",
             "description": "Adopt SLSA / Sigstore: signed commits, reproducible builds, signed container images, attestation at deploy"},
            {"name": "Centralized Secrets Management", "category": "Operational Mitigation",
             "description": "Vault / KMS with short-lived credentials; scan logs and images for secrets as a CI gate"},
            {"name": "GitOps and Drift Detection", "category": "Operational Mitigation",
             "description": "All config declarative in git, continuous reconciliation, alerts on out-of-band changes"},
            {"name": "Private Registry with Allow-Lists", "category": "Application Mitigation",
             "description": "Proxy package installs through a private registry with vetted allow-list and SBOM scanning"},
        ],
    },
    # ── OCTAVE ────────────────────────────────────────────────────────────────
    {
        "name": "OCTAVE",
        "description": (
            "Operationally Critical Threat, Asset, and Vulnerability Evaluation — "
            "organization-centric risk assessment (SEI/CERT). Focuses on critical assets."
        ),
        "threats": [
            {"name": "Deliberate Insider Action", "category": "Human Actor - Deliberate",
             "description": "Malicious employee or contractor misuses authorized access to steal, sabotage, or exfiltrate data"},
            {"name": "Accidental Insider Error", "category": "Human Actor - Accidental",
             "description": "Untrained staff misconfigure systems, email data to wrong recipient, or lose devices"},
            {"name": "External Cyber Attack", "category": "Human Actor - Deliberate",
             "description": "External adversary (cybercrime, nation-state, activist) targets organizational critical assets"},
            {"name": "System or Infrastructure Failure", "category": "System Problem",
             "description": "Hardware / software / network failure disrupts critical business processes"},
            {"name": "Natural Disaster or Physical Event", "category": "Other Problem",
             "description": "Fire, flood, earthquake, or power outage damages facility or infrastructure"},
            {"name": "Third-Party Supply Chain Compromise", "category": "Human Actor - Deliberate",
             "description": "Compromise of a vendor, MSP, or outsourced partner cascades into the organization"},
        ],
        "mitigations": [
            {"name": "Identify and Prioritize Critical Assets", "category": "Asset Management",
             "description": "Catalog critical information assets, owners, and business impact; focus controls on what matters most"},
            {"name": "Define Security Requirements per Asset", "category": "Asset Management",
             "description": "Document confidentiality / integrity / availability requirements per critical asset class"},
            {"name": "Conduct Annual Risk Assessment", "category": "Risk Assessment",
             "description": "Workshop-based threat/vulnerability identification led by the business, not just IT"},
            {"name": "Implement Defense-in-Depth Controls", "category": "Protection Strategy",
             "description": "Layered technical, administrative, and physical controls aligned with critical-asset requirements"},
            {"name": "Develop Business Continuity Plan", "category": "Protection Strategy",
             "description": "Documented BCP/DR plans tested regularly, covering infrastructure failure and natural events"},
            {"name": "Vendor Risk Management Program", "category": "Protection Strategy",
             "description": "Tier vendors by criticality; require attestation (SOC 2, ISO 27001) and incident-notification clauses"},
        ],
    },
    # ── Trike ─────────────────────────────────────────────────────────────────
    {
        "name": "Trike",
        "description": (
            "Trike — risk-based threat modeling from an auditor's perspective. "
            "Models threats against CRUD actions and actor-asset matrices."
        ),
        "threats": [
            {"name": "Unauthorized Create", "category": "CRUD - Create",
             "description": "Actor creates records they are not authorized to create (forged orders, planted evidence, spam entries)"},
            {"name": "Unauthorized Read", "category": "CRUD - Read",
             "description": "Actor reads data beyond their authorization (broken object-level authorization, IDOR)"},
            {"name": "Unauthorized Update", "category": "CRUD - Update",
             "description": "Actor modifies records they should not be able to change (privilege modification, amount tampering)"},
            {"name": "Unauthorized Delete", "category": "CRUD - Delete",
             "description": "Actor deletes records they should not be able to remove (log wiping, evidence destruction)"},
            {"name": "Denial of Authorized Action", "category": "Availability",
             "description": "Legitimate actor is blocked from performing an action they are authorized to perform (DoS, lockout)"},
            {"name": "Repudiation of Authorized Action", "category": "Non-repudiation",
             "description": "Actor performs an authorized action, later denies it, and the system cannot prove attribution"},
        ],
        "mitigations": [
            {"name": "Actor-Asset Authorization Matrix", "category": "Access Control",
             "description": "Explicit matrix defining which actors may perform which CRUD actions on each asset; enforce at every trust boundary"},
            {"name": "Object-Level Authorization Checks", "category": "Access Control",
             "description": "Verify authorization on every object access, not just at endpoint entry (defeats IDOR)"},
            {"name": "Field-Level Permissions", "category": "Access Control",
             "description": "Restrict update rights to specific fields, preventing mass-assignment privilege escalation"},
            {"name": "Soft Delete with Audit Trail", "category": "Data Integrity",
             "description": "Mark records deleted without removing them; retain who/when/what for forensic review"},
            {"name": "Rate Limiting and Circuit Breaking", "category": "Availability",
             "description": "Per-actor rate limits and adaptive circuit breakers to prevent denial of legitimate action"},
            {"name": "Cryptographically Signed Audit Log", "category": "Non-repudiation",
             "description": "Append-only, tamper-evident log with actor identity bound to every CRUD operation"},
        ],
    },
    # ── Attack Trees ──────────────────────────────────────────────────────────
    {
        "name": "Attack Trees",
        "description": (
            "Attack Trees — goal-oriented hierarchical decomposition of how an attacker "
            "can achieve an objective. Leaves are concrete attacks; branches are AND/OR combinations."
        ),
        "threats": [
            {"name": "Root Goal: Steal Customer Database", "category": "Data Theft Tree",
             "description": "Top-level attacker objective. Achievable via any of the child attack paths below (OR)"},
            {"name": "Path: Compromise DBA Credentials", "category": "Data Theft Tree",
             "description": "Attacker phishes or keyloggers the DBA, then logs in directly to the database"},
            {"name": "Path: Exploit SQL Injection in Admin Panel", "category": "Data Theft Tree",
             "description": "Attacker finds SQLi in less-protected internal admin panel and exfiltrates via UNION SELECT"},
            {"name": "Path: Physical Access to Backup Media", "category": "Data Theft Tree",
             "description": "Attacker steals offline tape/disk backup from storage or transport"},
            {"name": "Root Goal: Achieve Ransomware Detonation", "category": "Ransomware Tree",
             "description": "Top-level attacker objective: encrypt production data and demand ransom"},
            {"name": "Path: Initial Access via Phishing + Macro", "category": "Ransomware Tree",
             "description": "Phishing email with malicious macro gives attacker foothold on endpoint"},
            {"name": "Path: Lateral Movement via SMB + PsExec", "category": "Ransomware Tree",
             "description": "Attacker uses stolen hashes to move laterally to domain controller"},
            {"name": "Path: Mass Encryption via Group Policy", "category": "Ransomware Tree",
             "description": "Attacker pushes ransomware binary via GPO to encrypt all domain-joined hosts simultaneously"},
        ],
        "mitigations": [
            {"name": "Privileged Access Management for Admins", "category": "Data Theft Tree",
             "description": "PAM solution with session recording, JIT access, and dedicated admin workstations for DBAs"},
            {"name": "Parameterized Queries on All Surfaces", "category": "Data Theft Tree",
             "description": "SQL injection prevention enforced in both customer-facing and internal admin code paths"},
            {"name": "Encrypt Backup Media at Rest", "category": "Data Theft Tree",
             "description": "Full-disk / full-tape encryption with keys separated from backup media; chain-of-custody logs"},
            {"name": "Email Macro Policy Enforcement", "category": "Ransomware Tree",
             "description": "Block macros from Internet-sourced files by policy; sandbox attachments before delivery"},
            {"name": "Disable SMBv1 and Restrict Admin Shares", "category": "Ransomware Tree",
             "description": "Eliminate legacy SMB, restrict C$/ADMIN$ to dedicated jump hosts; enforce LAPS for local admin"},
            {"name": "Protected GPO with Deployment Review", "category": "Ransomware Tree",
             "description": "Restrict GPO edit rights, require peer review for new GPOs deploying binaries"},
            {"name": "Offline Immutable Backups", "category": "Ransomware Tree",
             "description": "3-2-1 backup strategy with at least one copy offline/immutable; test restores quarterly"},
            {"name": "Detection Along Every Branch", "category": "Attack Tree Hygiene",
             "description": "For each leaf node in the tree, ensure at least one detective control fires an alert"},
        ],
    },
    # ── Kill Chain ────────────────────────────────────────────────────────────
    {
        "name": "Kill Chain",
        "description": (
            "Lockheed Martin Cyber Kill Chain — seven phases of a targeted intrusion. "
            "Disrupting any single phase is sufficient to break the attack."
        ),
        "threats": [
            {"name": "Reconnaissance", "category": "Phase 1 - Recon",
             "description": "Attacker gathers intel: employee names via LinkedIn, subdomains via Shodan, tech stack via job postings"},
            {"name": "Weaponization", "category": "Phase 2 - Weaponize",
             "description": "Attacker couples exploit with payload into a deliverable artifact (malicious PDF, weaponized Office doc)"},
            {"name": "Delivery", "category": "Phase 3 - Deliver",
             "description": "Weaponized artifact reaches the victim via email, watering-hole site, USB drop, or supply-chain update"},
            {"name": "Exploitation", "category": "Phase 4 - Exploit",
             "description": "Payload triggers a vulnerability (CVE, zero-day, macro execution) and gains initial execution"},
            {"name": "Installation", "category": "Phase 5 - Install",
             "description": "Attacker establishes persistence: backdoor, scheduled task, service, or web shell"},
            {"name": "Command and Control", "category": "Phase 6 - C2",
             "description": "Implant beacons to attacker-controlled infrastructure for remote control (HTTP, DNS, ICMP tunneling)"},
            {"name": "Actions on Objectives", "category": "Phase 7 - Act",
             "description": "Attacker achieves goal: data exfiltration, ransomware, destruction, or pivot to further targets"},
        ],
        "mitigations": [
            {"name": "Reduce Public Attack Surface", "category": "Phase 1 - Recon",
             "description": "Minimize exposed subdomains, strip metadata from public docs, monitor threat-intel for employee targeting"},
            {"name": "Signed and Verified Software Distribution", "category": "Phase 2 - Weaponize",
             "description": "Code signing and SBOM attestation make weaponized binaries harder to impersonate legitimate software"},
            {"name": "Email Security and Attachment Sandboxing", "category": "Phase 3 - Deliver",
             "description": "Advanced email filtering, attachment detonation, link rewriting, user phishing-awareness training"},
            {"name": "Patching and Exploit Mitigations", "category": "Phase 4 - Exploit",
             "description": "Timely patching, EDR with exploit-guard features, application allow-listing, browser/Office hardening"},
            {"name": "Endpoint Persistence Monitoring", "category": "Phase 5 - Install",
             "description": "EDR alerts on new services/scheduled tasks/run keys; audit startup items and WMI subscriptions"},
            {"name": "Egress Filtering and DNS Monitoring", "category": "Phase 6 - C2",
             "description": "Block outbound to untrusted destinations, detect DNS tunneling and beaconing patterns"},
            {"name": "Data Loss Prevention and Network Segmentation", "category": "Phase 7 - Act",
             "description": "DLP on critical egress paths, micro-segmentation to limit lateral movement from initial foothold"},
        ],
    },
    # ── MITRE ATT&CK ──────────────────────────────────────────────────────────
    {
        "name": "MITRE ATT&CK",
        "description": (
            "MITRE ATT&CK Cloud/Web subset — Adversarial Tactics, Techniques, and Common Knowledge "
            "mapping attacker behaviors from initial access through impact"
        ),
        "threats": [
            # Initial Access
            {"name": "Phishing for Application Credentials", "category": "Initial Access",
             "description": "Attacker sends targeted phishing emails with fake login pages to harvest application credentials"},
            {"name": "Exploit Public-Facing Application", "category": "Initial Access",
             "description": "Attacker exploits vulnerability in internet-facing application (SQLi, RCE, XXE) to gain initial foothold"},
            {"name": "Valid Account Abuse", "category": "Initial Access",
             "description": "Attacker uses legitimately obtained credentials (from breach, phishing, or brute force) to access systems"},
            {"name": "Supply Chain Compromise", "category": "Initial Access",
             "description": "Attacker compromises software supply chain (library, build tool, CDN) to deliver malicious code to targets"},
            {"name": "Drive-By Compromise", "category": "Initial Access",
             "description": "Victim visits attacker-controlled or compromised website delivering client-side exploits through the browser"},
            # Execution
            {"name": "Malicious Script Execution via User Interaction", "category": "Execution",
             "description": "Attacker tricks user into executing malicious scripts through social engineering or file downloads"},
            {"name": "Server-Side Code Execution via Injection", "category": "Execution",
             "description": "Attacker achieves remote code execution through injection vulnerabilities in server-side components"},
            {"name": "Malicious Container Image Execution", "category": "Execution",
             "description": "Attacker deploys containers built from tampered or malicious images to execute unauthorized code"},
            {"name": "Abuse of Cloud Functions and Serverless", "category": "Execution",
             "description": "Attacker invokes or modifies serverless functions to execute arbitrary code within cloud environment"},
            # Persistence
            {"name": "Web Shell Installation", "category": "Persistence",
             "description": "Attacker uploads web shell to compromised server to maintain persistent remote access"},
            {"name": "OAuth Application Abuse for Persistence", "category": "Persistence",
             "description": "Attacker creates or hijacks authorized OAuth application to maintain access even after password change"},
            {"name": "Cloud Account Backdoor Creation", "category": "Persistence",
             "description": "Attacker creates hidden admin or service accounts in cloud environments for persistent access"},
            {"name": "Malicious Browser Extension", "category": "Persistence",
             "description": "Attacker installs browser extension that persists across sessions to intercept credentials and data"},
            # Privilege Escalation
            {"name": "Misconfigured IAM Role Exploitation", "category": "Privilege Escalation",
             "description": "Attacker exploits overly permissive IAM roles or trust relationships to escalate cloud privileges"},
            {"name": "Access Token Manipulation", "category": "Privilege Escalation",
             "description": "Attacker steals, forges, or manipulates access tokens to impersonate higher-privileged identities"},
            {"name": "Container Escape to Host", "category": "Privilege Escalation",
             "description": "Attacker breaks out of container isolation to access host system and further escalate privileges"},
            # Defense Evasion
            {"name": "Log and Audit Trail Clearing", "category": "Defense Evasion",
             "description": "Attacker deletes or disables logging to remove evidence of malicious activity from target systems"},
            {"name": "Obfuscated Payload Delivery", "category": "Defense Evasion",
             "description": "Attacker encodes or obfuscates malicious payloads to evade signature-based detection systems"},
            {"name": "Living-Off-The-Land Techniques", "category": "Defense Evasion",
             "description": "Attacker uses legitimate tools and system utilities to blend in with normal activity and avoid detection"},
            # Credential Access
            {"name": "Brute Force Credential Attack", "category": "Credential Access",
             "description": "Attacker systematically tries username/password combinations to gain unauthorized access"},
            {"name": "Credential Stuffing Attack", "category": "Credential Access",
             "description": "Attacker uses breached username/password pairs from other services against the target application"},
            {"name": "Cloud Metadata Credential Theft", "category": "Credential Access",
             "description": "Attacker accesses cloud instance metadata service to steal IAM credentials and temporary tokens"},
            # Exfiltration
            {"name": "Data Exfiltration via Cloud Storage", "category": "Exfiltration",
             "description": "Attacker copies sensitive data to attacker-controlled cloud storage buckets"},
            {"name": "Data Exfiltration over Encrypted Channels", "category": "Exfiltration",
             "description": "Attacker exfiltrates data over HTTPS or DNS tunneling to evade data loss prevention controls"},
            {"name": "Scheduled Automated Data Transfer", "category": "Exfiltration",
             "description": "Attacker sets up automated recurring transfers of data to external systems to avoid spike detection"},
            # Impact
            {"name": "Ransomware Deployment", "category": "Impact",
             "description": "Attacker encrypts application data or databases and demands payment for decryption keys"},
            {"name": "Resource Hijacking for Cryptomining", "category": "Impact",
             "description": "Attacker hijacks cloud compute resources for unauthorized cryptocurrency mining causing cost and performance impact"},
            {"name": "Data Destruction Attack", "category": "Impact",
             "description": "Attacker irreversibly deletes or corrupts critical application data and backups"},
            {"name": "Website Defacement", "category": "Impact",
             "description": "Attacker modifies public-facing web content to damage reputation or spread misinformation"},
            {"name": "Denial of Service via Resource Exhaustion", "category": "Impact",
             "description": "Attacker overwhelms application resources through flooding or algorithmic complexity to cause outages"},
        ],
        "mitigations": [
            {"name": "Phishing-Resistant MFA (FIDO2/WebAuthn)", "category": "Initial Access",
             "description": "Deploy hardware security keys or passkeys that resist phishing and man-in-the-middle credential theft"},
            {"name": "Vendor and Supply Chain Risk Management", "category": "Initial Access",
             "description": "Assess and continuously monitor security posture of third-party vendors and software suppliers"},
            {"name": "Zero Trust Network Access (ZTNA)", "category": "Initial Access",
             "description": "Enforce identity-based access for all resources regardless of network location, eliminating implicit trust"},
            {"name": "Microsegmentation", "category": "Initial Access",
             "description": "Segment workloads at the individual service level to limit blast radius from any single compromise"},
            {"name": "Application Allowlisting", "category": "Execution",
             "description": "Allow only approved applications and scripts to execute using application control policies"},
            {"name": "Sandboxed Execution Environments", "category": "Execution",
             "description": "Run user-submitted code and untrusted workloads in isolated sandboxes with restricted system access"},
            {"name": "File Integrity Monitoring (FIM)", "category": "Persistence",
             "description": "Monitor critical files, configurations, and web directories for unauthorized modifications"},
            {"name": "Web Shell Detection and Prevention", "category": "Persistence",
             "description": "Scan web directories for web shells, restrict write permissions on web-accessible directories"},
            {"name": "OAuth Application Audit and Governance", "category": "Persistence",
             "description": "Regularly audit authorized OAuth applications, revoke unused tokens, and alert on new app authorizations"},
            {"name": "Privileged Identity Management (PIM)", "category": "Privilege Escalation",
             "description": "Use just-in-time privileged access with approval workflows and automatic expiration"},
            {"name": "IAM Policy Least Privilege Enforcement", "category": "Privilege Escalation",
             "description": "Regularly audit and tighten IAM roles using access analyzer tools to remove excessive permissions"},
            {"name": "East-West Traffic Inspection", "category": "Privilege Escalation",
             "description": "Inspect lateral traffic between internal services using service mesh or network security controls"},
            {"name": "Centralized Log Aggregation and Immutability", "category": "Defense Evasion",
             "description": "Ship logs to immutable centralized SIEM in real time so local log deletion cannot erase evidence"},
            {"name": "Behavioral Anomaly Detection (UEBA)", "category": "Defense Evasion",
             "description": "Use ML-based user and entity behavior analytics to detect unusual activity deviating from baselines"},
            {"name": "Endpoint Detection and Response (EDR)", "category": "Defense Evasion",
             "description": "Deploy EDR on all servers and endpoints to detect living-off-the-land and fileless attack techniques"},
            {"name": "Credential Monitoring and Breach Alerting", "category": "Credential Access",
             "description": "Monitor dark web and breach databases for leaked credentials and alert affected users immediately"},
            {"name": "Privileged Account Vaulting", "category": "Credential Access",
             "description": "Store privileged credentials in PAM vault with session recording and just-in-time checkout"},
            {"name": "Data Loss Prevention (DLP)", "category": "Exfiltration",
             "description": "Implement DLP policies to detect and block unauthorized transfer of sensitive data"},
            {"name": "Egress Traffic Filtering", "category": "Exfiltration",
             "description": "Restrict and monitor outbound network traffic to approved destinations only"},
            {"name": "Cloud Access Security Broker (CASB)", "category": "Exfiltration",
             "description": "Deploy CASB to monitor and control data movement to and from cloud storage services"},
            {"name": "Immutable Backup Strategy", "category": "Impact",
             "description": "Maintain offline and immutable backups using WORM storage to enable recovery from ransomware or destruction"},
            {"name": "Incident Response and Recovery Plan", "category": "Impact",
             "description": "Maintain tested IR playbooks for ransomware, data destruction, defacement, and resource hijacking incidents"},
            {"name": "Cloud Cost Anomaly Alerting", "category": "Impact",
             "description": "Set budget alerts and anomaly detection on cloud spending to quickly detect cryptomining resource hijacking"},
        ],
    },

    # ── CVSS Risk Framework ───────────────────────────────────────────────────
    {
        "name": "CVSS Risk Framework",
        "description": (
            "CVSS-based Risk Framework — infrastructure and application vulnerability classes "
            "mapped to CVSS v3 scoring dimensions: Attack Vector, Authentication, "
            "Confidentiality, Integrity, Availability, and Scope"
        ),
        "threats": [
            # Network Exposure (Attack Vector: Network)
            {"name": "Externally Accessible Debug Interface", "category": "Network Exposure",
             "description": "Debug endpoints (Actuator, phpinfo, debug toolbar) exposed to internet revealing internals and enabling manipulation"},
            {"name": "Unauthenticated Service Port Exposure", "category": "Network Exposure",
             "description": "Internal services (databases, caches, admin UIs) accessible from internet without authentication"},
            {"name": "Firewall Rule Misconfiguration", "category": "Network Exposure",
             "description": "Overly permissive firewall or security group rules expose unnecessary services to untrusted networks"},
            {"name": "Public Cloud Storage Bucket Exposure", "category": "Network Exposure",
             "description": "S3, GCS, or Azure Blob containers configured with public read access exposing sensitive files"},
            {"name": "Open Redirect Vulnerability", "category": "Network Exposure",
             "description": "Application redirects to attacker-supplied URLs enabling phishing attacks and credential harvesting"},
            # Authentication
            {"name": "Unauthenticated Admin Interface", "category": "Authentication",
             "description": "Administrative interfaces accessible without any authentication allowing full system compromise"},
            {"name": "Default or Hardcoded Service Credentials", "category": "Authentication",
             "description": "Services deployed with unchanged default credentials or hardcoded passwords in configuration files"},
            {"name": "API Endpoint Without Authentication", "category": "Authentication",
             "description": "API endpoints that require authentication are accessible without any credentials"},
            {"name": "Unenforced MFA Policy", "category": "Authentication",
             "description": "MFA policy defined but not technically enforced, allowing users to bypass second-factor requirements"},
            # Confidentiality
            {"name": "Sensitive Data in Version Control", "category": "Confidentiality",
             "description": "API keys, passwords, certificates, or PII committed to source code repositories"},
            {"name": "Unencrypted Database Accessible from Internet", "category": "Confidentiality",
             "description": "Database containing sensitive data reachable without encryption from the public internet"},
            {"name": "Unencrypted Backup Files", "category": "Confidentiality",
             "description": "Database or file backups stored without encryption enabling data theft if storage is compromised"},
            {"name": "Overly Permissive IAM Role", "category": "Confidentiality",
             "description": "Cloud IAM roles with wildcard permissions allowing broad access to sensitive resources"},
            # Integrity
            {"name": "Unsigned Container Images in Production", "category": "Integrity",
             "description": "Container images deployed without signature verification allowing tampered images to run"},
            {"name": "Missing Checksum Verification on Artifacts", "category": "Integrity",
             "description": "Build artifacts or installers distributed without checksums enabling supply chain tampering"},
            {"name": "Infrastructure Configuration Drift", "category": "Integrity",
             "description": "Infrastructure state diverges from declared configuration allowing unauthorized changes to persist undetected"},
            # Availability
            {"name": "Single Point of Failure Architecture", "category": "Availability",
             "description": "Critical application components without redundancy causing complete outages from single component failures"},
            {"name": "Missing Database Replication and Failover", "category": "Availability",
             "description": "Database without replication or automatic failover leading to extended downtime during failures"},
            {"name": "No Circuit Breaker for Downstream Dependencies", "category": "Availability",
             "description": "Failure of downstream services cascades to complete application failure without circuit breaker protection"},
            # Scope
            {"name": "Container Escape Vulnerability", "category": "Scope",
             "description": "Vulnerability in container runtime or configuration allows attacker to break out to the host system"},
            {"name": "Cross-Tenant Data Access in Multi-Tenant System", "category": "Scope",
             "description": "Insufficient tenant isolation allows one tenant to access another tenant's data or resources"},
        ],
        "mitigations": [
            {"name": "Attack Surface Management", "category": "Network Exposure",
             "description": "Continuously discover and monitor externally exposed assets to identify unauthorized or risky exposures"},
            {"name": "Network Access Control Lists (ACLs)", "category": "Network Exposure",
             "description": "Implement strict ACLs and security groups following deny-by-default with minimal port exposure"},
            {"name": "Cloud Security Groups Hardening", "category": "Network Exposure",
             "description": "Audit and tighten cloud security groups, remove any 0.0.0.0/0 ingress rules for non-web ports"},
            {"name": "Safe URL Redirect Allowlisting", "category": "Network Exposure",
             "description": "Validate redirect targets against allowlist of trusted domains, reject external or user-supplied URLs"},
            {"name": "Zero Trust Identity Verification", "category": "Authentication",
             "description": "Verify every access request regardless of source; apply identity-based controls without network-level trust"},
            {"name": "Admin Interface Network Isolation", "category": "Authentication",
             "description": "Restrict admin interfaces to VPN-only or private network access, never expose to public internet"},
            {"name": "Automated Default Credential Detection", "category": "Authentication",
             "description": "Scan infrastructure for default credentials during provisioning and block deployment if found"},
            {"name": "Secrets Detection in CI/CD Pipeline", "category": "Confidentiality",
             "description": "Use pre-commit hooks and CI scanning (Gitleaks, Trufflehog) to prevent secrets from entering repositories"},
            {"name": "IAM Least Privilege with Regular Access Reviews", "category": "Confidentiality",
             "description": "Apply least privilege to all IAM roles and review permissions quarterly using access analyzer tools"},
            {"name": "Data Classification and Encryption Policy", "category": "Confidentiality",
             "description": "Classify data by sensitivity and apply appropriate encryption standards for each classification tier"},
            {"name": "Container Image Signing (Cosign/Notary)", "category": "Integrity",
             "description": "Sign all container images with Sigstore Cosign and enforce signature verification before deployment"},
            {"name": "Infrastructure as Code with Drift Detection", "category": "Integrity",
             "description": "Declare all infrastructure as code and use drift detection to identify and remediate unauthorized changes"},
            {"name": "Artifact Checksum Verification", "category": "Integrity",
             "description": "Generate and publish SHA-256 checksums for all release artifacts and verify before use"},
            {"name": "High Availability Architecture Design", "category": "Availability",
             "description": "Design systems with redundant components, load balancing, and multi-AZ deployment for resilience"},
            {"name": "Circuit Breaker and Retry Pattern", "category": "Availability",
             "description": "Implement circuit breakers to prevent cascade failures and retry with exponential backoff for transient errors"},
            {"name": "Database Replication and Automated Failover", "category": "Availability",
             "description": "Configure synchronous replication and automatic failover to minimize RTO/RPO during database failures"},
            {"name": "Namespace and Tenant Isolation", "category": "Scope",
             "description": "Enforce strict namespace-level isolation between tenants using dedicated resources and network policies"},
            {"name": "Container Runtime Security Controls", "category": "Scope",
             "description": "Apply seccomp profiles, AppArmor policies, drop capabilities, and use read-only root filesystems"},
        ],
    },

    # ── OWASP ASVS ────────────────────────────────────────────────────────────
    {
        "name": "OWASP ASVS",
        "description": (
            "OWASP Application Security Verification Standard — "
            "security requirements and controls for designing, building, "
            "and testing modern web applications and APIs"
        ),
        "threats": [
            # Architecture
            {"name": "Missing Security Architecture Review", "category": "Architecture",
             "description": "Application built without threat modeling or security review leaving fundamental design vulnerabilities unaddressed"},
            {"name": "Insecure Inter-Service Communication", "category": "Architecture",
             "description": "Microservices communicate without mutual authentication or encryption exposing internal APIs to compromise"},
            {"name": "Hardcoded Configuration and Secrets", "category": "Architecture",
             "description": "Environment-specific secrets and configuration embedded in code rather than injected at runtime"},
            {"name": "Insufficient Defense-in-Depth Layers", "category": "Architecture",
             "description": "Single security control failure leads to full compromise due to absent compensating controls"},
            # Authentication
            {"name": "Insufficient Password Complexity Requirements", "category": "Authentication",
             "description": "No minimum password length or complexity requirements make accounts vulnerable to brute force attacks"},
            {"name": "Missing Brute Force Protection on Auth Endpoints", "category": "Authentication",
             "description": "Authentication endpoints lack lockout, CAPTCHA, or rate limiting allowing unlimited login attempts"},
            {"name": "Insecure Remember-Me Token Implementation", "category": "Authentication",
             "description": "Persistent login tokens are predictable, long-lived, or not rotated on use enabling session fixation"},
            {"name": "OAuth2 Authorization Code Interception", "category": "Authentication",
             "description": "OAuth2 flows without PKCE allow authorization codes to be intercepted and exchanged by attackers"},
            {"name": "Missing Re-authentication for Sensitive Actions", "category": "Authentication",
             "description": "High-risk operations (password change, payment, MFA removal) don't require fresh authentication"},
            {"name": "Account Enumeration via Timing Attack", "category": "Authentication",
             "description": "Different response times for valid vs invalid usernames allow attackers to enumerate registered accounts"},
            # Session Management
            {"name": "Session Not Invalidated on Logout", "category": "Session Management",
             "description": "Server-side session data persists after logout allowing reuse of captured tokens"},
            {"name": "Concurrent Session Abuse", "category": "Session Management",
             "description": "No concurrent session limits allow attackers to maintain persistent access alongside the legitimate user"},
            {"name": "Long-Lived Refresh Tokens Without Rotation", "category": "Session Management",
             "description": "Non-rotating refresh tokens with long expiry give attackers persistent access if stolen"},
            {"name": "Session Token Transmitted in URL", "category": "Session Management",
             "description": "Session identifiers included in URLs leak in browser history, server logs, and Referer headers"},
            # Access Control
            {"name": "Missing Horizontal Access Control", "category": "Access Control",
             "description": "Application verifies authentication but not ownership, allowing users to access other users' resources"},
            {"name": "Wildcard Permission Grants", "category": "Access Control",
             "description": "Roles or API keys granted wildcard permissions providing far more access than necessary"},
            {"name": "Privilege Persistence After Role Change", "category": "Access Control",
             "description": "Active sessions retain old permissions after role downgrade or account deactivation until re-login"},
            {"name": "Insufficient API Key Scope Enforcement", "category": "Access Control",
             "description": "API keys not restricted to specific operations allowing abuse beyond their intended scope"},
            # Cryptography
            {"name": "Password Hashing with Weak Algorithm", "category": "Cryptography",
             "description": "Passwords stored using MD5, SHA-1, or unsalted SHA-256 instead of memory-hard algorithms like Argon2"},
            {"name": "Weak Random Number Generation for Security Tokens", "category": "Cryptography",
             "description": "Cryptographic operations use pseudo-random number generators unsuitable for security-sensitive contexts"},
            {"name": "Missing Perfect Forward Secrecy in TLS", "category": "Cryptography",
             "description": "TLS configuration without PFS cipher suites allows decryption of recorded traffic if long-term key is compromised"},
            {"name": "Insufficient Cryptographic Key Rotation", "category": "Cryptography",
             "description": "Encryption keys and signing secrets never rotated increasing the impact window of any key compromise"},
            # Error Handling
            {"name": "Stack Traces Exposed to End Users", "category": "Error Handling",
             "description": "Unhandled exceptions return full stack traces revealing code structure, paths, and system information"},
            {"name": "Exception-Based Security Decision Flow", "category": "Error Handling",
             "description": "Security decisions based on catching exceptions rather than explicit validation leading to logic bypasses"},
            # Data Protection
            {"name": "Sensitive Fields Displayed in Plaintext", "category": "Data Protection",
             "description": "Passwords, card numbers, or SSNs displayed in plaintext in UI or API responses after initial entry"},
            {"name": "Caching of Sensitive API Responses", "category": "Data Protection",
             "description": "Sensitive API responses cached by browsers or CDNs exposing data to subsequent users on shared devices"},
            {"name": "PII Written to Application Logs", "category": "Data Protection",
             "description": "Personally identifiable information inadvertently included in structured or unstructured application logs"},
            # API Security
            {"name": "GraphQL Introspection Enabled in Production", "category": "API Security",
             "description": "GraphQL schema introspection enabled in production reveals full API structure aiding attacker reconnaissance"},
            {"name": "Missing Content-Type Validation on REST API", "category": "API Security",
             "description": "API accepts requests with missing or incorrect Content-Type enabling injection via unexpected media formats"},
            {"name": "Batch API Request Abuse", "category": "API Security",
             "description": "Batch endpoints allow attackers to amplify attack impact by bundling many operations in a single request"},
            # Configuration
            {"name": "Overly Permissive CORS Policy", "category": "Configuration",
             "description": "CORS configured with wildcard origins or credentials flag enabling cross-origin data theft"},
            {"name": "Debug Mode Enabled in Production", "category": "Configuration",
             "description": "Application deployed with debug flags active exposing internals and disabling security controls"},
            {"name": "Missing Security Response Headers Suite", "category": "Configuration",
             "description": "Absence of HSTS, CSP, X-Frame-Options, and Permissions-Policy leaves browser-level attacks unmitigated"},
        ],
        "mitigations": [
            {"name": "Security Architecture Review in SDLC", "category": "Architecture",
             "description": "Integrate threat modeling and security architecture review as mandatory gates before implementation begins"},
            {"name": "Mutual TLS for Inter-Service Communication", "category": "Architecture",
             "description": "Enforce mTLS between all internal microservices using service mesh to authenticate and encrypt all traffic"},
            {"name": "Runtime Secret Injection via Vault", "category": "Architecture",
             "description": "Inject secrets at runtime via vault sidecar or environment injection, never bake into images or source code"},
            {"name": "Defense-in-Depth Control Layering", "category": "Architecture",
             "description": "Layer independent security controls so that bypass of one layer is insufficient for full compromise"},
            {"name": "Argon2id Password Hashing", "category": "Authentication",
             "description": "Hash passwords with Argon2id (or bcrypt/scrypt) with appropriate memory and iteration cost parameters"},
            {"name": "Progressive Authentication Delays with CAPTCHA", "category": "Authentication",
             "description": "Apply exponential backoff after failed login attempts combined with CAPTCHA for automated attack protection"},
            {"name": "PKCE for all OAuth2 Authorization Code Flows", "category": "Authentication",
             "description": "Require Proof Key for Code Exchange (PKCE) for all OAuth2 flows to prevent authorization code interception"},
            {"name": "Step-Up Authentication for Sensitive Operations", "category": "Authentication",
             "description": "Require fresh MFA verification before high-risk operations regardless of existing session age"},
            {"name": "Timing-Safe Authentication Responses", "category": "Authentication",
             "description": "Use constant-time comparison and uniform response times for all authentication outcomes to prevent enumeration"},
            {"name": "Server-Side Session Invalidation on Logout", "category": "Session Management",
             "description": "Invalidate server-side session state immediately on logout; reject any future use of the old session token"},
            {"name": "Concurrent Session Enforcement", "category": "Session Management",
             "description": "Limit active sessions per user and notify or terminate prior sessions when a new login occurs"},
            {"name": "Refresh Token Rotation Policy", "category": "Session Management",
             "description": "Issue a new refresh token with each use and immediately invalidate the previous one to limit theft window"},
            {"name": "Attribute-Based Access Control (ABAC)", "category": "Access Control",
             "description": "Evaluate access decisions using resource attributes and user context for fine-grained authorization"},
            {"name": "Deny-by-Default Permission Model", "category": "Access Control",
             "description": "Grant no permissions by default; require explicit grants for each operation and resource combination"},
            {"name": "Immediate Privilege Revocation on Role Change", "category": "Access Control",
             "description": "Invalidate all active sessions and tokens immediately when user roles are changed or accounts deactivated"},
            {"name": "Approved Cryptographic Algorithm Policy", "category": "Cryptography",
             "description": "Maintain an approved algorithm list (AES-256, RSA-4096, Argon2id) and enforce via code review and SAST scanning"},
            {"name": "Cryptographically Secure PRNG Usage", "category": "Cryptography",
             "description": "Use OS-provided CSPRNG (os.urandom, SecureRandom) for all security-sensitive random values"},
            {"name": "Automated Cryptographic Key Rotation", "category": "Cryptography",
             "description": "Automate encryption key rotation on defined schedules using KMS with key versioning for zero-downtime rotation"},
            {"name": "Generic Error Response Templates", "category": "Error Handling",
             "description": "Return standardized error responses containing no implementation details, stack traces, or internal file paths"},
            {"name": "Input Schema Validation at API Entry Points", "category": "Error Handling",
             "description": "Validate all inputs against explicit schemas at API boundaries before any business logic processing begins"},
            {"name": "Field-Level Masking for Sensitive Data", "category": "Data Protection",
             "description": "Mask sensitive fields (card numbers, SSNs) in API responses, UIs, and logs using format-preserving techniques"},
            {"name": "Cache-Control Headers for Sensitive Endpoints", "category": "Data Protection",
             "description": "Set Cache-Control: no-store on all responses containing personal or sensitive data to prevent CDN and browser caching"},
            {"name": "PII Scrubbing in Log Pipeline", "category": "Data Protection",
             "description": "Implement log processing rules to detect and redact PII patterns before logs reach storage or SIEM systems"},
            {"name": "Disable GraphQL Introspection in Production", "category": "API Security",
             "description": "Disable schema introspection in production and use query allowlists or persisted queries for known clients"},
            {"name": "Strict Content-Type Enforcement on APIs", "category": "API Security",
             "description": "Validate Content-Type header matches expected format and reject requests with mismatched or missing content types"},
            {"name": "Batch Request Rate Limiting by Item Count", "category": "API Security",
             "description": "Apply rate limits to batch operations based on total item count per request, not just request frequency"},
            {"name": "Strict CORS Policy with Explicit Origin Allowlist", "category": "Configuration",
             "description": "Specify an explicit origin allowlist in CORS headers, never use wildcards with credentials enabled"},
            {"name": "Production Environment Hardening Checklist", "category": "Configuration",
             "description": "Enforce a pre-deployment checklist to disable debug modes, development tools, and test accounts before go-live"},
            {"name": "Complete Security Response Header Suite", "category": "Configuration",
             "description": "Configure HSTS, CSP, X-Frame-Options, X-Content-Type-Options, and Permissions-Policy on all responses"},
        ],
    },
    # ── OWASP Top 10 for LLM Applications ─────────────────────────────────────
    {
        "name": "OWASP LLM Top 10",
        "description": (
            "The OWASP Top 10 for Large Language Model Applications (2025 edition) "
            "identifies the most critical security risks specific to LLM-powered "
            "systems—from prompt injection and sensitive data exposure to supply chain "
            "weaknesses and unbounded resource consumption. See "
            "https://genai.owasp.org/llm-top-10/ for the full specification."
        ),
        "threats": [
            {"name": "LLM01: Prompt Injection", "category": "Prompt Injection",
             "description": "Attackers craft malicious inputs that override or manipulate an LLM's system prompt or context window, causing the model to ignore its instructions, leak confidential data, or execute unintended actions. Both direct injection (via user messages) and indirect injection (via poisoned external content retrieved by the LLM) are covered."},
            {"name": "LLM02: Sensitive Information Disclosure", "category": "Information Disclosure",
             "description": "LLMs may inadvertently reveal confidential information—including personal data, proprietary business logic, or system configuration—through their training data memorisation, overly verbose responses, or misconfigured access controls around retrieval-augmented context."},
            {"name": "LLM03: Supply Chain Vulnerabilities", "category": "Supply Chain",
             "description": "LLM pipelines depend on third-party components—pretrained base models, fine-tuning datasets, plugins, vector stores, and external APIs—each of which may introduce vulnerabilities, backdoors, or malicious modifications that are inherited by the final application."},
            {"name": "LLM04: Data and Model Poisoning", "category": "Data and Model Poisoning",
             "description": "Adversaries corrupt the data used to train, fine-tune, or feed (via RAG) an LLM, introducing biases, backdoors, or hidden behaviours. Poisoned models may produce subtly incorrect, harmful, or attacker-controlled outputs in specific trigger conditions."},
            {"name": "LLM05: Improper Output Handling", "category": "Improper Output Handling",
             "description": "When LLM-generated text is passed unsanitised to downstream systems—browsers, shells, databases, or APIs—it can trigger Cross-Site Scripting (XSS), Server-Side Request Forgery (SSRF), code injection, or remote code execution depending on the consuming system."},
            {"name": "LLM06: Excessive Agency", "category": "Excessive Agency",
             "description": "LLM agents granted overly broad permissions, capabilities, or access to external tools can take high-impact autonomous actions beyond what is required for their intended purpose, leading to unintended data modifications, service disruptions, or privilege escalation."},
            {"name": "LLM07: System Prompt Leakage", "category": "System Prompt Leakage",
             "description": "Attackers induce the LLM to reveal the contents of its confidential system prompt, exposing business logic, safety guardrails, hidden instructions, or proprietary configurations that can be exploited to craft more effective subsequent attacks."},
            {"name": "LLM08: Vector and Embedding Weaknesses", "category": "Vector and Embedding Weaknesses",
             "description": "Retrieval-Augmented Generation (RAG) systems rely on vector databases and embedding models that can be manipulated through adversarial document injection, embedding inversion attacks, or access-control gaps, allowing attackers to influence what context is retrieved and fed to the LLM."},
            {"name": "LLM09: Misinformation", "category": "Misinformation",
             "description": "LLMs can generate plausible-sounding but factually incorrect, misleading, or hallucinated content. When this output is presented without appropriate caveats or human review—especially in high-stakes domains such as healthcare, law, or finance—it can cause direct harm or undermine trust."},
            {"name": "LLM10: Unbounded Consumption", "category": "Unbounded Consumption",
             "description": "Applications that allow unlimited LLM inference requests, excessive context sizes, or runaway agentic loops are vulnerable to Denial-of-Wallet attacks, cost amplification, and service disruption. Adversaries can also exploit these weaknesses for competitive model extraction."},
        ],
        "mitigations": [
            {"name": "Input Validation and Sanitisation", "category": "Prompt Injection",
             "description": "Validate, sanitise, and contextually escape all user-supplied text before passing it to the LLM. Use allow-lists for expected input formats and reject or neutralise attempts to embed instruction-like patterns in user data."},
            {"name": "Privilege-Separated Prompt Architecture", "category": "Prompt Injection",
             "description": "Clearly demarcate system instructions from user content using structural separators, distinct roles, or separate API calls. Treat user-provided text as untrusted data—never interpolate it directly into privileged instruction blocks."},
            {"name": "Minimum Necessary Data in Context", "category": "Information Disclosure",
             "description": "Restrict what sensitive information is included in the LLM context window. Apply data classification policies so personally identifiable information, secrets, and confidential business logic are not unnecessarily retrieved or passed to the model."},
            {"name": "Output Filtering and Redaction", "category": "Information Disclosure",
             "description": "Apply post-processing filters to LLM responses to detect and redact sensitive patterns such as PII, credentials, or internal infrastructure details before responses are returned to users or downstream systems."},
            {"name": "Supply Chain Integrity Verification", "category": "Supply Chain",
             "description": "Verify cryptographic checksums or signatures for all model weights, datasets, and third-party plugins before use. Prefer models and components sourced from audited, reputable providers with published transparency reports."},
            {"name": "Training Data Provenance and Auditing", "category": "Data and Model Poisoning",
             "description": "Maintain a complete audit trail for all data used in pre-training, fine-tuning, and RAG pipelines. Implement anomaly detection to identify unexpected distributions or patterns in datasets that may indicate poisoning."},
            {"name": "LLM Output Encoding for Downstream Systems", "category": "Improper Output Handling",
             "description": "Treat all LLM output as untrusted input when passing it to downstream components. Apply context-appropriate encoding (HTML escaping, shell quoting, parameterised queries) before the output is rendered, executed, or stored."},
            {"name": "Least-Privilege Agent Permissions", "category": "Excessive Agency",
             "description": "Grant LLM agents only the minimum permissions, tool access, and data scopes required to complete their intended tasks. Implement explicit action allow-lists and require human-in-the-loop confirmation for high-impact or irreversible operations."},
            {"name": "System Prompt Confidentiality Controls", "category": "System Prompt Leakage",
             "description": "Do not rely solely on the LLM to keep system prompts secret. Store sensitive instructions outside the context window where possible, monitor outputs for prompt leakage patterns, and treat system prompt contents as potentially observable by determined adversaries."},
            {"name": "RAG Access Control and Document Isolation", "category": "Vector and Embedding Weaknesses",
             "description": "Apply row-level and document-level access controls to vector stores so that retrieval is scoped to what the requesting user is authorised to read. Implement namespace isolation and content-integrity checks to detect injected adversarial documents."},
            {"name": "Grounding and Source Attribution", "category": "Misinformation",
             "description": "Ground LLM responses against authoritative, verified knowledge sources and provide citations so users can evaluate accuracy independently. Clearly label AI-generated content and implement confidence thresholds below which human review is required."},
            {"name": "Rate Limiting and Token Budget Controls", "category": "Unbounded Consumption",
             "description": "Enforce per-user, per-session, and per-application token limits and request rate caps. Set maximum context sizes and output lengths. Implement cost alerts and hard budget ceilings to prevent runaway consumption and Denial-of-Wallet attacks."},
        ],
    },
    # ── MAESTRO (Agentic AI) ──────────────────────────────────────────────────
    {
        "name": "MAESTRO",
        "description": (
            "MAESTRO (Multi-Agent Environment, Security, Threat, Risk, & Outcome) — "
            "a layered threat-modeling framework for Agentic AI from the Cloud Security "
            "Alliance. It decomposes an agentic system into seven layers (Foundation "
            "Models, Data Operations, Agent Frameworks, Deployment & Infrastructure, "
            "Evaluation & Observability, Security & Compliance, and the Agent Ecosystem) "
            "and models threats within each layer plus cross-layer threats. "
            "Categories below map to the MAESTRO layers."
        ),
        "threats": [
            # Layer 1 — Foundation Models
            {"name": "Adversarial Examples", "category": "Layer 1: Foundation Models",
             "description": "Crafted inputs that fool the foundation model into incorrect or attacker-chosen outputs"},
            {"name": "Model Stealing via API Queries", "category": "Layer 1: Foundation Models",
             "description": "Systematic querying of a model's API to reconstruct or approximate the underlying model"},
            {"name": "Backdoor Attack with Hidden Triggers", "category": "Layer 1: Foundation Models",
             "description": "Hidden triggers embedded in the model that cause malicious behavior when activated"},
            {"name": "Membership Inference Attack", "category": "Layer 1: Foundation Models",
             "description": "Inferring whether specific records were in the training data, leaking sensitive information"},
            {"name": "Training-Time Data Poisoning", "category": "Layer 1: Foundation Models",
             "description": "Corrupting training data to degrade the model or implant attacker-controlled behavior"},
            {"name": "Model Reprogramming", "category": "Layer 1: Foundation Models",
             "description": "Repurposing a deployed model to perform tasks unintended by its operators"},
            {"name": "Compute-Exhaustion Denial of Service", "category": "Layer 1: Foundation Models",
             "description": "Computationally expensive queries that exhaust inference resources and deny availability"},

            # Layer 2 — Data Operations
            {"name": "Data Poisoning in Pipelines", "category": "Layer 2: Data Operations",
             "description": "Manipulating data in preparation/processing pipelines feeding the agent"},
            {"name": "Data Exfiltration from Stores", "category": "Layer 2: Data Operations",
             "description": "Unauthorized extraction of data from databases, vector stores, or caches"},
            {"name": "Data Infrastructure Denial of Service", "category": "Layer 2: Data Operations",
             "description": "Overwhelming databases or vector stores to deny availability of data operations"},
            {"name": "Data Tampering in Transit or at Rest", "category": "Layer 2: Data Operations",
             "description": "Altering data while stored or moving between data components"},
            {"name": "RAG Pipeline Injection", "category": "Layer 2: Data Operations",
             "description": "Injecting malicious content into a retrieval-augmented-generation pipeline to steer agent output"},

            # Layer 3 — Agent Frameworks
            {"name": "Compromised Framework Component", "category": "Layer 3: Agent Frameworks",
             "description": "A trojaned or tampered component within the agent development framework"},
            {"name": "Framework Backdoor", "category": "Layer 3: Agent Frameworks",
             "description": "A backdoor planted in the agent framework enabling covert control"},
            {"name": "Framework Input Validation Weakness", "category": "Layer 3: Agent Frameworks",
             "description": "Missing or weak input validation in framework APIs exploited to inject or escape"},
            {"name": "Supply Chain Dependency Attack", "category": "Layer 3: Agent Frameworks",
             "description": "Malicious or vulnerable third-party dependencies pulled into the agent framework"},
            {"name": "Framework API Denial of Service", "category": "Layer 3: Agent Frameworks",
             "description": "Abusing framework APIs to exhaust resources and deny service"},
            {"name": "Framework Evasion", "category": "Layer 3: Agent Frameworks",
             "description": "Techniques that bypass safety or control mechanisms built into the framework"},

            # Layer 4 — Deployment & Infrastructure
            {"name": "Compromised Container Image", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Malicious or vulnerable container images used to run agents"},
            {"name": "Orchestration Attack", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Exploitation of orchestration platforms such as Kubernetes hosting the agents"},
            {"name": "Infrastructure-as-Code Manipulation", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Tampering with IaC definitions to weaken or backdoor the deployed environment"},
            {"name": "Infrastructure Denial of Service", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Denial-of-service against the infrastructure supporting agent execution"},
            {"name": "Resource Hijacking", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Hijacking compute/storage resources (e.g. for cryptomining) at the expense of the system"},
            {"name": "Lateral Movement Across Infrastructure", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Moving laterally through infrastructure after an initial foothold"},

            # Layer 5 — Evaluation & Observability
            {"name": "Evaluation Metric Manipulation", "category": "Layer 5: Evaluation & Observability",
             "description": "Tampering with evaluation metrics to mask poor or malicious agent behavior"},
            {"name": "Compromised Observability Tools", "category": "Layer 5: Evaluation & Observability",
             "description": "Subverting monitoring/observability tooling to hide anomalies"},
            {"name": "Evaluation Infrastructure DoS", "category": "Layer 5: Evaluation & Observability",
             "description": "Denial-of-service against evaluation and monitoring infrastructure"},
            {"name": "Detection Evasion", "category": "Layer 5: Evaluation & Observability",
             "description": "Techniques that avoid triggering anomaly detection and monitoring"},
            {"name": "Data Leakage Through Monitoring", "category": "Layer 5: Evaluation & Observability",
             "description": "Sensitive data exposed through monitoring and observability systems"},
            {"name": "Observability Data Poisoning", "category": "Layer 5: Evaluation & Observability",
             "description": "Poisoning observability data so dashboards and alerts misrepresent reality"},

            # Layer 6 — Security & Compliance
            {"name": "Security Agent Data Poisoning", "category": "Layer 6: Security & Compliance",
             "description": "Poisoning the data that security AI agents rely on, degrading their judgment"},
            {"name": "Evasion of Security AI Agents", "category": "Layer 6: Security & Compliance",
             "description": "Crafting activity that evades detection by AI-based security agents"},
            {"name": "Compromised Security Agent", "category": "Layer 6: Security & Compliance",
             "description": "An attacker takes control of a security agent, turning a defense into a liability"},
            {"name": "Regulatory Non-Compliance by Security Agents", "category": "Layer 6: Security & Compliance",
             "description": "Security agents acting in ways that violate regulatory obligations"},
            {"name": "Bias in Security Systems", "category": "Layer 6: Security & Compliance",
             "description": "Bias in security agents causing systematic blind spots or unfair outcomes"},
            {"name": "Lack of Explainability in Security Decisions", "category": "Layer 6: Security & Compliance",
             "description": "Opaque security-agent decisions that cannot be audited or justified"},
            {"name": "Model Extraction of Security Agents", "category": "Layer 6: Security & Compliance",
             "description": "Extracting a security agent's model to learn how to evade it"},

            # Layer 7 — Agent Ecosystem
            {"name": "Agent Impersonation", "category": "Layer 7: Agent Ecosystem",
             "description": "A malicious agent masquerades as a trusted agent to abuse integrations or users"},
            {"name": "Agent Identity Attack", "category": "Layer 7: Agent Ecosystem",
             "description": "Forging or stealing agent identities to gain unauthorized capabilities"},
            {"name": "Tool Misuse", "category": "Layer 7: Agent Ecosystem",
             "description": "An agent abusing the tools/integrations it can call to cause harm"},
            {"name": "Goal Manipulation", "category": "Layer 7: Agent Ecosystem",
             "description": "Manipulating an agent's objectives so it pursues attacker-chosen goals"},
            {"name": "Marketplace Manipulation", "category": "Layer 7: Agent Ecosystem",
             "description": "Gaming the agent marketplace (pricing, ranking, discovery) for malicious ends"},
            {"name": "Compromised Agent Registry", "category": "Layer 7: Agent Ecosystem",
             "description": "Tampering with the registry agents are discovered and trusted through"},
            {"name": "Malicious Agent Discovery", "category": "Layer 7: Agent Ecosystem",
             "description": "Surfacing malicious agents to users/other agents via discovery mechanisms"},
            {"name": "Inaccurate Capability Description", "category": "Layer 7: Agent Ecosystem",
             "description": "Agents advertising false capabilities to be selected and then misbehave"},
            {"name": "Agent Repudiation", "category": "Layer 7: Agent Ecosystem",
             "description": "Inability to attribute agent actions, allowing agents to deny what they did"},

            # Cross-Layer
            {"name": "Cross-Layer Supply Chain Compromise", "category": "Cross-Layer",
             "description": "A single supply-chain compromise that affects multiple MAESTRO layers at once"},
            {"name": "Cross-Layer Lateral Movement", "category": "Cross-Layer",
             "description": "Exploiting boundaries between layers to move from one layer into another"},
            {"name": "Cross-Layer Privilege Escalation", "category": "Cross-Layer",
             "description": "Escalating privileges by chaining weaknesses across multiple layers"},
            {"name": "Inter-Layer Data Leakage", "category": "Cross-Layer",
             "description": "Sensitive data leaking through the interactions between layers"},
            {"name": "Goal Misalignment Cascade", "category": "Cross-Layer",
             "description": "Misaligned goals propagating between agents and layers, amplifying harm"},
        ],
        "mitigations": [
            # Cross-layer controls
            {"name": "Defense in Depth Across Layers", "category": "Cross-Layer",
             "description": "Layer multiple, independent security controls so no single failure is catastrophic"},
            {"name": "Secure Inter-Layer Communication", "category": "Cross-Layer",
             "description": "Authenticate, encrypt, and validate all communication crossing layer boundaries"},
            {"name": "System-Wide Anomaly Monitoring", "category": "Cross-Layer",
             "description": "Monitor behavior across all layers to detect anomalies that single-layer views miss"},
            {"name": "Multi-Layer Incident Response Plan", "category": "Cross-Layer",
             "description": "Plan and rehearse coordinated response to incidents spanning several layers"},

            # AI-specific controls
            {"name": "Adversarial Training", "category": "AI-Specific",
             "description": "Train agents against adversarial examples to harden them at the model layer"},
            {"name": "Formal Verification of Goal Alignment", "category": "AI-Specific",
             "description": "Use formal methods to verify agent behavior stays within intended goals and bounds"},
            {"name": "Explainable AI (XAI)", "category": "AI-Specific",
             "description": "Make agent decisions transparent and auditable to support oversight and compliance"},
            {"name": "Red Teaming of Agents", "category": "AI-Specific",
             "description": "Run simulated attacks against agents to surface vulnerabilities before adversaries do"},
            {"name": "Runtime Safety Monitoring", "category": "AI-Specific",
             "description": "Continuously detect and intervene on unsafe agent behavior at runtime"},

            # Layer-specific controls
            {"name": "Model Access Rate Limiting", "category": "Layer 1: Foundation Models",
             "description": "Throttle and quota model API access to blunt model-stealing and compute-exhaustion attacks"},
            {"name": "RAG Input Sanitization & Source Vetting", "category": "Layer 2: Data Operations",
             "description": "Validate and vet retrieved content before it reaches the agent to prevent RAG injection/poisoning"},
            {"name": "Framework Input Validation", "category": "Layer 3: Agent Frameworks",
             "description": "Rigorously validate inputs to framework APIs to block injection and evasion"},
            {"name": "Dependency Pinning & SBOM", "category": "Layer 3: Agent Frameworks",
             "description": "Pin dependencies and maintain a software bill of materials to manage supply-chain risk"},
            {"name": "Container Image Signing & Scanning", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Sign and scan container images, and admit only trusted, scanned images to runtime"},
            {"name": "Orchestration Hardening", "category": "Layer 4: Deployment & Infrastructure",
             "description": "Apply least-privilege RBAC, network policies, and CIS hardening to the orchestration platform"},
            {"name": "Observability Data Integrity Controls", "category": "Layer 5: Evaluation & Observability",
             "description": "Protect the integrity of metrics and logs so monitoring cannot be silently subverted"},
            {"name": "Strong Agent Identity & Authentication", "category": "Layer 7: Agent Ecosystem",
             "description": "Issue and verify cryptographic agent identities to prevent impersonation and identity attacks"},
            {"name": "Verified Agent Registry & Capability Attestation", "category": "Layer 7: Agent Ecosystem",
             "description": "Sign registry entries and attest agent capabilities to counter malicious discovery and false claims"},
        ],
    },
]


# ── Seeder ────────────────────────────────────────────────────────────────────

def _seed_framework(db: Session, fw: dict) -> None:
    """Seed one framework — creates it if missing, then upserts threats and mitigations by name."""
    # Get or create framework
    framework = db.query(Framework).filter(Framework.name == fw["name"]).first()
    if not framework:
        framework = Framework(name=fw["name"], description=fw.get("description", ""))
        db.add(framework)
        db.commit()
        db.refresh(framework)
        logger.info("  Created framework: %s", fw["name"])
    else:
        logger.debug("  Framework already exists: %s", fw["name"])

    # Seed threats (skip entries that already exist by name)
    existing_threat_names = {
        row[0]
        for row in db.query(Threat.name).filter(Threat.framework_id == framework.id).all()
    }
    new_threats = [
        Threat(framework_id=framework.id, is_custom=False, **t)
        for t in fw["threats"]
        if t["name"] not in existing_threat_names
    ]
    if new_threats:
        db.bulk_save_objects(new_threats)
        logger.info("  Added %d threats to '%s'", len(new_threats), fw["name"])

    # Seed mitigations (skip entries that already exist by name)
    existing_mitigation_names = {
        row[0]
        for row in db.query(Mitigation.name).filter(Mitigation.framework_id == framework.id).all()
    }
    new_mitigations = [
        Mitigation(framework_id=framework.id, is_custom=False, **m)
        for m in fw["mitigations"]
        if m["name"] not in existing_mitigation_names
    ]
    if new_mitigations:
        db.bulk_save_objects(new_mitigations)
        logger.info("  Added %d mitigations to '%s'", len(new_mitigations), fw["name"])

    db.commit()


def seed_knowledge_base() -> None:
    """
    Seed all registered frameworks, threats, and mitigations.

    Safe to call on every startup — existing entries are never duplicated or
    overwritten.  New entries in FRAMEWORKS_REGISTRY are inserted automatically.
    """
    db = SessionLocal()
    try:
        logger.info("Seeding knowledge base (%d frameworks)…", len(FRAMEWORKS_REGISTRY))
        for fw in FRAMEWORKS_REGISTRY:
            _seed_framework(db, fw)
        logger.info("Knowledge base seeding complete.")
    except Exception:
        db.rollback()
        logger.exception("Knowledge base seeding failed — rolled back.")
        raise
    finally:
        db.close()

    # Seed the Component Threat Library
    _seed_component_library()


def _seed_component_library() -> None:
    """
    Seed the Component Threat Library templates.

    Imports the COMPONENTS list from populate_component_library and inserts
    any templates not already present (idempotent by slug).
    """
    try:
        # Import here to avoid circular imports at module load time
        import sys
        import os

        # Allow importing the root-level populate script
        backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if backend_root not in sys.path:
            sys.path.insert(0, backend_root)

        from populate_component_library import COMPONENTS
        from app.models.component_template import ComponentTemplate

        db = SessionLocal()
        try:
            existing_slugs = {
                row[0]
                for row in db.query(ComponentTemplate.slug).all()
            }

            new_components = [
                ComponentTemplate(
                    name=c["name"],
                    slug=c["slug"],
                    category=c["category"],
                    node_type=c["node_type"],
                    icon=c.get("icon"),
                    description=c.get("description"),
                    threats=c["threats"],
                    mitigations=c["mitigations"],
                    is_custom=False,
                    created_by=None,
                )
                for c in COMPONENTS
                if c["slug"] not in existing_slugs
            ]

            if new_components:
                db.bulk_save_objects(new_components)
                db.commit()
                logger.info(
                    "Component library seeding complete: added %d templates.",
                    len(new_components),
                )
            else:
                logger.debug("Component library already seeded — no new templates added.")

            # ── Populate KB links (framework-aware FK pivot tables) ──────────
            _seed_component_kb_links(db, COMPONENTS)

        except Exception:
            db.rollback()
            logger.exception("Component library seeding failed — rolled back.")
            raise
        finally:
            db.close()

    except ImportError:
        logger.warning(
            "populate_component_library.py not found — skipping component library seeding."
        )


def _seed_component_kb_links(db, _components: list) -> None:
    """
    Populate component_template_threats / component_template_mitigations using
    the CURATED mappings in seed_component_kb_links_curated.py — specific
    threat/mitigation IDs per component per framework.

    Clears any existing broad-category links first, then inserts the curated ones.
    Idempotent on re-runs (clears and re-inserts — safe because it's pure reference data).
    """
    from app.models.component_template import ComponentTemplate
    from app.models.component_template_link import ComponentTemplateThreat, ComponentTemplateMitigation
    from app.models.framework import Framework

    try:
        import sys, os
        backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if backend_root not in sys.path:
            sys.path.insert(0, backend_root)
        from seed_component_kb_links_curated import CURATED
    except ImportError:
        logger.warning("seed_component_kb_links_curated.py not found — skipping curated KB links.")
        return

    try:
        framework_name_to_id = {f.name: f.id for f in db.query(Framework).all()}
        slug_to_id = {c.slug: c.id for c in db.query(ComponentTemplate).all()}

        # Clear all existing links (curated seed is authoritative)
        db.query(ComponentTemplateThreat).delete()
        db.query(ComponentTemplateMitigation).delete()
        db.flush()

        new_threat_links = []
        new_mit_links = []
        seen_t: set[tuple] = set()
        seen_m: set[tuple] = set()

        for slug, fw_map in CURATED.items():
            comp_id = slug_to_id.get(slug)
            if not comp_id:
                continue
            for fw_name, data in fw_map.items():
                fw_id = framework_name_to_id.get(fw_name)
                if not fw_id:
                    continue
                for tid in data.get("t", []):
                    if (comp_id, tid) not in seen_t:
                        new_threat_links.append(ComponentTemplateThreat(component_id=comp_id, threat_id=tid))
                        seen_t.add((comp_id, tid))
                for mid in data.get("m", []):
                    if (comp_id, mid) not in seen_m:
                        new_mit_links.append(ComponentTemplateMitigation(component_id=comp_id, mitigation_id=mid))
                        seen_m.add((comp_id, mid))

        if new_threat_links:
            db.bulk_save_objects(new_threat_links)
        if new_mit_links:
            db.bulk_save_objects(new_mit_links)
        db.commit()
        logger.info(
            "Component curated KB links seeded: %d threat links, %d mitigation links across %d components.",
            len(new_threat_links), len(new_mit_links), len(slug_to_id),
        )
    except Exception:
        db.rollback()
        logger.exception("Component KB links seeding failed — rolled back.")
