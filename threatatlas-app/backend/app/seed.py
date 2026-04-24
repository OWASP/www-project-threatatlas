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
    # Representative subset covering all 14 enterprise tactics. Full taxonomy
    # (~200 techniques + subtechniques) would be better imported from attack.mitre.org
    # — this seed provides a starting point the app can extend.
    {
        "name": "MITRE ATT&CK",
        "description": (
            "MITRE ATT&CK (Enterprise) — adversary tactics and techniques based on "
            "real-world observations. This seed covers representative techniques across "
            "the 14 tactics; the full taxonomy can be imported from attack.mitre.org."
        ),
        "threats": [
            # Reconnaissance
            {"name": "T1595 — Active Scanning", "category": "Reconnaissance",
             "description": "Adversary scans victim infrastructure to identify vulnerabilities (vuln scans, IP block scans, wordlist-based enumeration)"},
            {"name": "T1589 — Gather Victim Identity Information", "category": "Reconnaissance",
             "description": "Collect credentials, employee names, and email addresses from public sources or breach dumps"},
            # Resource Development
            {"name": "T1583 — Acquire Infrastructure", "category": "Resource Development",
             "description": "Adversary purchases or leases servers, domains, or botnet time for later phases of the operation"},
            {"name": "T1587 — Develop Capabilities", "category": "Resource Development",
             "description": "Adversary develops their own malware, exploits, or signing certificates rather than buying off-the-shelf"},
            # Initial Access
            {"name": "T1566 — Phishing", "category": "Initial Access",
             "description": "Targeted emails with malicious attachments or links used to gain initial foothold"},
            {"name": "T1190 — Exploit Public-Facing Application", "category": "Initial Access",
             "description": "Exploit internet-exposed web application (SQLi, RCE, deserialization) to gain execution"},
            {"name": "T1078 — Valid Accounts", "category": "Initial Access",
             "description": "Use stolen, purchased, or reused credentials to log in through legitimate authentication flows"},
            # Execution
            {"name": "T1059 — Command and Scripting Interpreter", "category": "Execution",
             "description": "Use PowerShell, bash, Python, or AppleScript to execute attacker commands on compromised host"},
            {"name": "T1053 — Scheduled Task/Job", "category": "Execution",
             "description": "Abuse Task Scheduler, cron, or systemd timers to execute payload on a schedule"},
            # Persistence
            {"name": "T1547 — Boot or Logon Autostart Execution", "category": "Persistence",
             "description": "Registry Run keys, startup folders, or init scripts to persist across reboots"},
            {"name": "T1136 — Create Account", "category": "Persistence",
             "description": "Create local, domain, or cloud account to maintain access even if original vector is closed"},
            # Privilege Escalation
            {"name": "T1068 — Exploitation for Privilege Escalation", "category": "Privilege Escalation",
             "description": "Exploit kernel or userland CVE to escalate from low-privilege user to SYSTEM or root"},
            {"name": "T1548 — Abuse Elevation Control Mechanism", "category": "Privilege Escalation",
             "description": "Bypass UAC, setuid binaries, or sudo misconfigurations to gain elevated privileges"},
            # Defense Evasion
            {"name": "T1070 — Indicator Removal", "category": "Defense Evasion",
             "description": "Clear event logs, delete files, wipe shell history to cover tracks"},
            {"name": "T1027 — Obfuscated Files or Information", "category": "Defense Evasion",
             "description": "Encoded, encrypted, or packed payloads that evade static signature detection"},
            # Credential Access
            {"name": "T1003 — OS Credential Dumping", "category": "Credential Access",
             "description": "Dump LSASS, SAM, or /etc/shadow to extract credentials for lateral movement"},
            {"name": "T1110 — Brute Force", "category": "Credential Access",
             "description": "Password guessing, credential stuffing, or password spraying against authentication endpoints"},
            # Discovery
            {"name": "T1087 — Account Discovery", "category": "Discovery",
             "description": "Enumerate local, domain, and cloud accounts to identify privileged targets"},
            {"name": "T1046 — Network Service Discovery", "category": "Discovery",
             "description": "Port/service scanning within the compromised network to find reachable internal services"},
            # Lateral Movement
            {"name": "T1021 — Remote Services", "category": "Lateral Movement",
             "description": "Use RDP, SSH, SMB, WinRM, VNC with valid credentials to move between hosts"},
            {"name": "T1550 — Use Alternate Authentication Material", "category": "Lateral Movement",
             "description": "Pass-the-hash, pass-the-ticket, or OAuth token theft to authenticate without the plaintext password"},
            # Collection
            {"name": "T1005 — Data from Local System", "category": "Collection",
             "description": "Harvest files of interest from compromised endpoints before exfiltration"},
            {"name": "T1056 — Input Capture", "category": "Collection",
             "description": "Keylogging, credential prompts, or form grabbing to capture user input"},
            # Command and Control
            {"name": "T1071 — Application Layer Protocol", "category": "Command and Control",
             "description": "C2 over HTTP(S), DNS, mail protocols, or messaging apps to blend with normal traffic"},
            {"name": "T1572 — Protocol Tunneling", "category": "Command and Control",
             "description": "Tunnel C2 traffic inside DNS, ICMP, or legitimate protocols to evade egress controls"},
            # Exfiltration
            {"name": "T1041 — Exfiltration Over C2 Channel", "category": "Exfiltration",
             "description": "Use the established C2 channel to upload stolen data back to the adversary"},
            {"name": "T1567 — Exfiltration Over Web Service", "category": "Exfiltration",
             "description": "Upload data to cloud storage (Dropbox, MEGA, S3) that is allow-listed from the victim network"},
            # Impact
            {"name": "T1486 — Data Encrypted for Impact", "category": "Impact",
             "description": "Ransomware encryption of files to extort payment or disrupt operations"},
            {"name": "T1485 — Data Destruction", "category": "Impact",
             "description": "Wiper-style destruction of data and systems, often disguised as ransomware"},
            {"name": "T1499 — Endpoint Denial of Service", "category": "Impact",
             "description": "Resource exhaustion, application exploitation, or service stop to deny legitimate use"},
        ],
        "mitigations": [
            {"name": "M1056 — Pre-compromise Intelligence", "category": "Reconnaissance",
             "description": "Monitor for recon activity (scanning, DNS enumeration) and reduce public attack surface"},
            {"name": "M1031 — Network Intrusion Prevention", "category": "Initial Access",
             "description": "IPS/WAF to block exploit attempts against public-facing apps; rate-limit auth endpoints"},
            {"name": "M1017 — User Training", "category": "Initial Access",
             "description": "Phishing simulations, reporting mechanisms, and continuous security awareness training"},
            {"name": "M1038 — Execution Prevention", "category": "Execution",
             "description": "Application allow-listing, script-block logging, constrained-language mode for PowerShell"},
            {"name": "M1018 — User Account Management", "category": "Persistence",
             "description": "Review unknown accounts; disable unused accounts; require approval for new privileged accounts"},
            {"name": "M1026 — Privileged Account Management", "category": "Privilege Escalation",
             "description": "Separate standard and privileged accounts, LAPS for local admin, JIT/PAM for domain admin"},
            {"name": "M1049 — Antivirus/Antimalware + EDR", "category": "Defense Evasion",
             "description": "Behavioral EDR with tamper-resistant logging; detect log-clearing and persistence creation"},
            {"name": "M1027 — Password Policies", "category": "Credential Access",
             "description": "Strong password requirements, breach-password blocklists, MFA on all authentication surfaces"},
            {"name": "M1030 — Network Segmentation", "category": "Lateral Movement",
             "description": "Tier-based network segmentation, jump hosts for admin traffic, deny-by-default east-west rules"},
            {"name": "M1037 — Filter Network Traffic", "category": "Command and Control",
             "description": "Egress filtering to trusted destinations only, TLS inspection where policy-permitted, DNS sinkhole for known C2"},
            {"name": "M1057 — Data Loss Prevention", "category": "Exfiltration",
             "description": "DLP rules on egress, large-upload anomaly detection, alert on uploads to non-corporate cloud storage"},
            {"name": "M1053 — Data Backup", "category": "Impact",
             "description": "Offline, immutable backups with tested restore playbook to recover from ransomware and wipers"},
            {"name": "M1032 — Multi-factor Authentication", "category": "Credential Access",
             "description": "MFA for all remote access, privileged accounts, and cloud consoles; phishing-resistant factors preferred"},
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
