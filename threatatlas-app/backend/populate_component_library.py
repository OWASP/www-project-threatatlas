"""
Populate the Component Threat Library with ~45 pre-built component templates.
Run this script once after running the Alembic migration:

    alembic upgrade head
    python populate_component_library.py

Fully idempotent — existing slugs are skipped.
"""
from app.database import SessionLocal
from app.models.component_template import ComponentTemplate

COMPONENTS = [
    # ── Cloud Storage ─────────────────────────────────────────────
    {
        "name": "AWS S3 Bucket", "slug": "aws-s3", "category": "Cloud Storage",
        "node_type": "datastore", "icon": "database",
        "description": "Amazon S3 object storage bucket",
        "threats": [
            {"name": "S3 Bucket Public Exposure", "description": "Misconfigured bucket ACL or policy allows public read/write access to sensitive objects.", "category": "Information Disclosure", "severity_hint": "critical"},
            {"name": "Missing Server-Side Encryption", "description": "Objects stored without SSE-S3, SSE-KMS, or SSE-C encryption, exposing data at rest.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "S3 Access Logging Disabled", "description": "No audit trail of who accessed or modified objects, preventing forensic investigation.", "category": "Repudiation", "severity_hint": "medium"},
            {"name": "Overly Permissive Bucket Policy", "description": "Bucket policy grants excessive permissions (e.g. s3:* to *) enabling unauthorized data access.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "S3 Object Versioning Disabled", "description": "No versioning means ransomware or accidental deletion permanently destroys data.", "category": "Tampering", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Enable S3 Block Public Access", "description": "Enable all four Block Public Access settings at account and bucket level.", "category": "Access Control"},
            {"name": "Enable Server-Side Encryption (SSE-KMS)", "description": "Configure default SSE-KMS encryption with a customer-managed KMS key.", "category": "Encryption"},
            {"name": "Enable S3 Access Logging and Object-Level CloudTrail", "description": "Log all API calls and object-level events to a separate audit bucket.", "category": "Logging & Monitoring"},
        ],
    },
    {
        "name": "Azure Blob Storage", "slug": "azure-blob", "category": "Cloud Storage",
        "node_type": "datastore", "icon": "database",
        "description": "Microsoft Azure Blob Storage container",
        "threats": [
            {"name": "Public Container Access", "description": "Container set to Blob or Container access level exposes objects without authentication.", "category": "Information Disclosure", "severity_hint": "critical"},
            {"name": "SAS Token Overpermission", "description": "Shared Access Signatures granted with excessive permissions or no expiry.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Unencrypted Data at Rest", "description": "Customer-managed key not configured, relying solely on Microsoft-managed keys.", "category": "Information Disclosure", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Enforce Private Access Level", "description": "Set container access level to Private and disable anonymous access.", "category": "Access Control"},
            {"name": "Use Short-Lived SAS Tokens with Minimal Scope", "description": "Generate SAS tokens with least-privilege permissions and short expiry windows.", "category": "Access Control"},
        ],
    },
    {
        "name": "Google Cloud Storage", "slug": "gcs-bucket", "category": "Cloud Storage",
        "node_type": "datastore", "icon": "database",
        "description": "Google Cloud Storage bucket",
        "threats": [
            {"name": "AllUsers or AllAuthenticatedUsers ACL", "description": "Bucket or object ACL grants access to all internet users or all Google accounts.", "category": "Information Disclosure", "severity_hint": "critical"},
            {"name": "Missing CMEK Encryption", "description": "Bucket uses Google-managed encryption keys instead of customer-managed keys.", "category": "Information Disclosure", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Enforce Uniform Bucket-Level Access", "description": "Enable uniform bucket-level access to prevent per-object ACL misconfigurations.", "category": "Access Control"},
            {"name": "Enable Data Access Audit Logs", "description": "Enable Cloud Audit Logs DATA_READ and DATA_WRITE for the bucket.", "category": "Logging & Monitoring"},
        ],
    },
    # ── Databases ──────────────────────────────────────────────────
    {
        "name": "PostgreSQL", "slug": "postgresql", "category": "Databases",
        "node_type": "datastore", "icon": "database",
        "description": "PostgreSQL relational database",
        "threats": [
            {"name": "SQL Injection", "description": "Unsanitized user input concatenated into SQL queries allows arbitrary query execution.", "category": "Tampering", "severity_hint": "critical"},
            {"name": "Weak or Default Credentials", "description": "Database accessible with default postgres/postgres credentials or weak passwords.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Unencrypted Data at Rest", "description": "Database files not encrypted at the OS or disk level.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Excessive User Privileges", "description": "Application user granted superuser or unnecessary table-level permissions.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "No TLS for Client Connections", "description": "Connections from application to database travel unencrypted over the network.", "category": "Information Disclosure", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Use Parameterized Queries / Prepared Statements", "description": "Never concatenate user input into SQL; always use parameterized queries or ORMs.", "category": "Input Validation"},
            {"name": "Principle of Least Privilege for DB User", "description": "Create a dedicated application user with only SELECT/INSERT/UPDATE/DELETE on required tables.", "category": "Access Control"},
            {"name": "Enable SSL/TLS and Certificate Verification", "description": "Set ssl=require and verify-ca or verify-full in connection strings.", "category": "Encryption"},
        ],
    },
    {
        "name": "MySQL / MariaDB", "slug": "mysql", "category": "Databases",
        "node_type": "datastore", "icon": "database",
        "description": "MySQL or MariaDB relational database",
        "threats": [
            {"name": "SQL Injection", "description": "Unsanitized input in dynamic queries allows unauthorized data access or modification.", "category": "Tampering", "severity_hint": "critical"},
            {"name": "Network Exposure on Port 3306", "description": "MySQL port directly exposed to the internet or untrusted network segments.", "category": "Spoofing", "severity_hint": "high"},
            {"name": "Disabled Binary Logging", "description": "Without binary logs, point-in-time recovery and audit of changes is impossible.", "category": "Repudiation", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Restrict MySQL Bind Address", "description": "Set bind-address to 127.0.0.1 or internal network IP; never expose to 0.0.0.0.", "category": "Network Security"},
            {"name": "Enable MySQL Audit Plugin", "description": "Install and configure the audit plugin to log all authentication and query events.", "category": "Logging & Monitoring"},
        ],
    },
    {
        "name": "MongoDB", "slug": "mongodb", "category": "Databases",
        "node_type": "datastore", "icon": "database",
        "description": "MongoDB NoSQL document database",
        "threats": [
            {"name": "Unauthenticated MongoDB Access", "description": "MongoDB started without --auth flag, allowing anyone to read and modify all databases.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "NoSQL Injection", "description": "Unsanitized JSON input manipulates query operators ($where, $gt) to bypass authentication.", "category": "Tampering", "severity_hint": "critical"},
            {"name": "Missing Field-Level Encryption", "description": "Sensitive fields (PII, PCI) stored as plaintext documents.", "category": "Information Disclosure", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Enable MongoDB Authentication and SCRAM", "description": "Always start mongod with --auth; use SCRAM-SHA-256 for all user accounts.", "category": "Access Control"},
            {"name": "Sanitize and Validate All Query Input", "description": "Strip or reject MongoDB operator characters ($, .) from user-controlled query fields.", "category": "Input Validation"},
        ],
    },
    {
        "name": "Redis", "slug": "redis", "category": "Databases",
        "node_type": "datastore", "icon": "database",
        "description": "Redis in-memory data store",
        "threats": [
            {"name": "Unauthenticated Redis Access", "description": "Redis running without requirepass exposes all data and CONFIG commands to anyone with network access.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Redis CONFIG Command Abuse", "description": "Attacker uses CONFIG SET to write arbitrary files (e.g. SSH keys, cron jobs) to the server.", "category": "Elevation of Privilege", "severity_hint": "critical"},
            {"name": "Sensitive Cache Data Exposure", "description": "Sessions, tokens, or PII cached in Redis accessible by any key enumeration.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "No TLS in Transit", "description": "Redis traffic sent in plaintext, exposing session tokens and cached data to network sniffing.", "category": "Information Disclosure", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Set requirepass and Disable Dangerous Commands", "description": "Configure requirepass with a strong password; rename or disable CONFIG, FLUSHALL, DEBUG commands.", "category": "Access Control"},
            {"name": "Enable Redis TLS", "description": "Configure tls-port and tls-cert-file for encrypted client connections.", "category": "Encryption"},
            {"name": "Bind Redis to Internal Network Only", "description": "Set bind to internal IP or 127.0.0.1; never expose Redis port to public internet.", "category": "Network Security"},
        ],
    },
    {
        "name": "DynamoDB", "slug": "dynamodb", "category": "Databases",
        "node_type": "datastore", "icon": "database",
        "description": "Amazon DynamoDB managed NoSQL database",
        "threats": [
            {"name": "Overly Permissive IAM Policy", "description": "Lambda or EC2 role has dynamodb:* on all tables instead of least-privilege access.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Missing Encryption at Rest", "description": "Table created without AWS-managed or customer-managed KMS encryption.", "category": "Information Disclosure", "severity_hint": "medium"},
            {"name": "DynamoDB Streams Data Exposure", "description": "DynamoDB Streams enabled but not protected, leaking change data to unauthorized consumers.", "category": "Information Disclosure", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Use Fine-Grained IAM Access Control", "description": "Apply IAM conditions (dynamodb:LeadingKeys) to restrict row-level access per user.", "category": "Access Control"},
            {"name": "Enable DynamoDB Encryption at Rest", "description": "Use AWS-managed or customer-managed KMS key for table encryption.", "category": "Encryption"},
        ],
    },
    {
        "name": "Elasticsearch / OpenSearch", "slug": "elasticsearch", "category": "Databases",
        "node_type": "datastore", "icon": "search",
        "description": "Elasticsearch or OpenSearch search and analytics engine",
        "threats": [
            {"name": "Unauthenticated Kibana/Dashboard Access", "description": "Elasticsearch or Kibana exposed without authentication, leaking all indexed data.", "category": "Information Disclosure", "severity_hint": "critical"},
            {"name": "Index Wildcard Access", "description": "Users granted access to * indexes instead of specific index names.", "category": "Elevation of Privilege", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Enable X-Pack Security or OpenSearch Security Plugin", "description": "Enable TLS and role-based access control for all cluster endpoints.", "category": "Access Control"},
            {"name": "Restrict Network Access with Security Groups", "description": "Block public internet access to Elasticsearch ports (9200, 9300).", "category": "Network Security"},
        ],
    },
    # ── Messaging & Queues ────────────────────────────────────────
    {
        "name": "Apache Kafka", "slug": "kafka", "category": "Messaging & Queues",
        "node_type": "process", "icon": "arrow-right-left",
        "description": "Apache Kafka distributed event streaming platform",
        "threats": [
            {"name": "Unauthenticated Kafka Broker Access", "description": "Kafka listener without SASL/SSL allows any producer or consumer to read all topics.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Sensitive PII in Topic Messages", "description": "Events contain unencrypted PII or payment data that consumers can retain indefinitely.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Topic Authorization Bypass", "description": "Missing ACLs allow any authenticated user to read from or produce to any topic.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Zookeeper Unauthenticated Access", "description": "Zookeeper ensemble accessible without SASL, allowing cluster metadata manipulation.", "category": "Tampering", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Enable Kafka SASL/SCRAM Authentication", "description": "Configure SASL_SCRAM-SHA-512 for all broker listeners and clients.", "category": "Access Control"},
            {"name": "Configure Kafka ACLs per Topic", "description": "Define per-topic ACLs restricting which service accounts can produce or consume.", "category": "Access Control"},
            {"name": "Encrypt Sensitive Fields Before Publishing", "description": "Encrypt PII or sensitive payload fields at the application layer before producing messages.", "category": "Encryption"},
        ],
    },
    {
        "name": "AWS SQS / SNS", "slug": "aws-sqs-sns", "category": "Messaging & Queues",
        "node_type": "process", "icon": "arrow-right-left",
        "description": "Amazon SQS queues and SNS topics",
        "threats": [
            {"name": "Overly Permissive Queue Policy", "description": "SQS queue policy allows sqs:* from any AWS account or Principal:*.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Unencrypted SQS Messages", "description": "Queue not configured with SSE-SQS or SSE-KMS, messages stored in plaintext.", "category": "Information Disclosure", "severity_hint": "medium"},
            {"name": "SNS Topic Data Exposure via HTTP Endpoint", "description": "SNS subscription delivers messages over HTTP instead of HTTPS, enabling interception.", "category": "Information Disclosure", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Enable SQS Encryption with SSE-KMS", "description": "Configure customer-managed KMS key for queue encryption.", "category": "Encryption"},
            {"name": "Restrict Queue Policy to Specific AWS Accounts", "description": "Use aws:SourceAccount and aws:SourceArn conditions in queue resource policies.", "category": "Access Control"},
        ],
    },
    {
        "name": "RabbitMQ", "slug": "rabbitmq", "category": "Messaging & Queues",
        "node_type": "process", "icon": "arrow-right-left",
        "description": "RabbitMQ message broker",
        "threats": [
            {"name": "Default Guest Credentials", "description": "RabbitMQ accessible with default guest/guest credentials from any host.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Management API Exposure", "description": "RabbitMQ management UI (port 15672) exposed to public network.", "category": "Elevation of Privilege", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Delete Default Guest User", "description": "Remove or rename the guest user; create application-specific users with vhost-scoped permissions.", "category": "Access Control"},
            {"name": "Enable RabbitMQ TLS", "description": "Configure TLS listeners for AMQP (5671) and Management API (15671).", "category": "Encryption"},
        ],
    },
    # ── Auth & Identity ────────────────────────────────────────────
    {
        "name": "OAuth2 / OIDC Provider", "slug": "oauth2-provider", "category": "Auth & Identity",
        "node_type": "external", "icon": "key-round",
        "description": "External OAuth2 or OIDC authorization server",
        "threats": [
            {"name": "Authorization Code Interception", "description": "Authorization code stolen via open redirect or referrer header before token exchange.", "category": "Spoofing", "severity_hint": "high"},
            {"name": "Redirect URI Manipulation", "description": "Attacker registers a malicious redirect_uri to steal authorization codes.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Implicit Flow Token Leakage", "description": "Access tokens in URL fragments exposed in browser history, logs, or referrer headers.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Insufficient Scope Validation", "description": "Application accepts tokens with wider scopes than needed, granting excessive access.", "category": "Elevation of Privilege", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Use Authorization Code Flow with PKCE", "description": "Replace implicit flow with Authorization Code + PKCE to prevent token leakage.", "category": "Authentication"},
            {"name": "Validate and Whitelist Redirect URIs", "description": "Register exact redirect URIs; reject any request with an unregistered redirect_uri.", "category": "Input Validation"},
            {"name": "Request Minimum Required Scopes", "description": "Request only the OAuth2 scopes your application actually needs; validate scopes on token receipt.", "category": "Access Control"},
        ],
    },
    {
        "name": "LDAP / Active Directory", "slug": "ldap-ad", "category": "Auth & Identity",
        "node_type": "external", "icon": "users",
        "description": "LDAP directory or Microsoft Active Directory",
        "threats": [
            {"name": "LDAP Injection", "description": "Unsanitized user input in LDAP filters allows authentication bypass or directory enumeration.", "category": "Tampering", "severity_hint": "critical"},
            {"name": "LDAP over Plaintext", "description": "LDAP bind credentials and directory data transmitted unencrypted over port 389.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Anonymous LDAP Bind", "description": "Directory server allows anonymous binds, leaking user and group data to unauthenticated clients.", "category": "Information Disclosure", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Use LDAPS or STARTTLS", "description": "Enforce LDAP over TLS (LDAPS port 636) or STARTTLS for all directory connections.", "category": "Encryption"},
            {"name": "Sanitize LDAP Filter Input", "description": "Escape all special LDAP characters in user-controlled input before constructing filters.", "category": "Input Validation"},
        ],
    },
    {
        "name": "JWT / Token Service", "slug": "jwt-service", "category": "Auth & Identity",
        "node_type": "process", "icon": "key-round",
        "description": "JWT token issuance and validation service",
        "threats": [
            {"name": "Algorithm Confusion Attack (alg:none)", "description": "JWT library accepts alg:none or allows RS256 to HS256 downgrade, enabling token forgery.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Weak Signing Secret", "description": "JWT signed with a short or guessable HMAC secret, allowing offline brute-force forgery.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Missing JWT Expiry (exp) Claim", "description": "Tokens without exp claim remain valid indefinitely, increasing breach impact.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Sensitive Data in JWT Payload", "description": "PII or secrets stored in unencrypted JWT payload, readable by anyone with the token.", "category": "Information Disclosure", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Enforce Allowed Algorithm List", "description": "Explicitly allowlist permitted algorithms (e.g. RS256); never accept alg:none.", "category": "Authentication"},
            {"name": "Use Short-Lived Tokens with Refresh Rotation", "description": "Set exp to 15 minutes; issue rotating refresh tokens with single-use enforcement.", "category": "Session Management"},
            {"name": "Sign with Asymmetric Keys (RS256/ES256)", "description": "Use RSA or ECDSA keys so verification public key is safe to distribute.", "category": "Cryptography"},
        ],
    },
    # ── API & Networking ───────────────────────────────────────────
    {
        "name": "API Gateway", "slug": "api-gateway", "category": "API & Networking",
        "node_type": "process", "icon": "network",
        "description": "API Gateway (AWS API Gateway, Kong, NGINX, etc.)",
        "threats": [
            {"name": "Lack of Rate Limiting / Throttling", "description": "No rate limiting on API endpoints enables brute-force attacks and denial-of-service.", "category": "Denial of Service", "severity_hint": "high"},
            {"name": "Missing API Authentication", "description": "API endpoints accessible without any authentication mechanism.", "category": "Spoofing", "severity_hint": "critical"},
            {"name": "Excessive Data Exposure via API Response", "description": "API returns full object including sensitive fields not needed by the client.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "HTTP Method Tampering", "description": "API accepts unintended HTTP methods (e.g. DELETE, PUT) on endpoints that should be read-only.", "category": "Tampering", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Implement Rate Limiting and Throttling", "description": "Apply per-client and global rate limits; return 429 with Retry-After headers.", "category": "Availability"},
            {"name": "Enforce API Key or OAuth2 Authentication", "description": "Require valid API key or Bearer token on all non-public endpoints.", "category": "Authentication"},
            {"name": "Use Response Schemas to Filter Fields", "description": "Return only fields defined in response schema; never serialize entire ORM objects.", "category": "Data Minimization"},
        ],
    },
    {
        "name": "Load Balancer", "slug": "load-balancer", "category": "API & Networking",
        "node_type": "process", "icon": "arrow-right-left",
        "description": "Layer 4/7 load balancer (ALB, NGINX, HAProxy)",
        "threats": [
            {"name": "HTTP Request Smuggling", "description": "Inconsistent handling of Content-Length and Transfer-Encoding between LB and backend allows request injection.", "category": "Tampering", "severity_hint": "high"},
            {"name": "TLS Termination Exposes Internal Traffic", "description": "TLS terminated at the LB without re-encryption to backends, sending plaintext over internal network.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Missing Security Headers Enforcement", "description": "LB does not add HSTS, CSP, X-Frame-Options, or X-Content-Type-Options headers.", "category": "Tampering", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Enable TLS Between LB and Backend (mTLS)", "description": "Configure mutual TLS from load balancer to all backend service instances.", "category": "Encryption"},
            {"name": "Add Security Response Headers at LB Layer", "description": "Configure HSTS, CSP, X-Frame-Options, and X-Content-Type-Options in LB response rules.", "category": "Defense in Depth"},
        ],
    },
    {
        "name": "CDN (CloudFront, Cloudflare)", "slug": "cdn", "category": "API & Networking",
        "node_type": "external", "icon": "globe",
        "description": "Content Delivery Network",
        "threats": [
            {"name": "Cache Poisoning", "description": "Attacker poisons CDN cache with malicious content served to all users requesting the same resource.", "category": "Tampering", "severity_hint": "high"},
            {"name": "Direct Origin Bypass", "description": "Attacker accesses origin server directly, bypassing CDN WAF and DDoS protection.", "category": "Denial of Service", "severity_hint": "high"},
            {"name": "Sensitive Data Cached at CDN Edge", "description": "Authentication tokens, PII, or personalized content cached and served to wrong users.", "category": "Information Disclosure", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Restrict Origin to CDN IP Ranges Only", "description": "Configure origin firewall to only accept traffic from CDN IP ranges.", "category": "Network Security"},
            {"name": "Configure Cache-Control Headers Correctly", "description": "Set Cache-Control: private or no-store on authenticated or sensitive responses.", "category": "Configuration"},
        ],
    },
    # ── Compute & Containers ───────────────────────────────────────
    {
        "name": "Docker Container", "slug": "docker-container", "category": "Compute & Containers",
        "node_type": "process", "icon": "box",
        "description": "Docker containerized application",
        "threats": [
            {"name": "Container Running as Root", "description": "Container process running as UID 0 increases blast radius of container escape vulnerabilities.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Privileged Container Mode", "description": "Container started with --privileged flag grants full host kernel capabilities.", "category": "Elevation of Privilege", "severity_hint": "critical"},
            {"name": "Sensitive Secrets in Environment Variables", "description": "Database passwords or API keys passed via ENV instructions or -e flags.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Unscanned or Outdated Base Image", "description": "Base image contains known CVEs not patched due to lack of image scanning.", "category": "Tampering", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Run Container as Non-Root User", "description": "Add USER directive in Dockerfile; use numeric UID (e.g. USER 1001).", "category": "Hardening"},
            {"name": "Use Docker Secrets or Vault for Credentials", "description": "Mount secrets as tmpfs files via Docker Secrets or Vault Agent; never use ENV for secrets.", "category": "Secrets Management"},
            {"name": "Enable Read-Only Root Filesystem", "description": "Start container with --read-only flag and mount specific writable paths as tmpfs.", "category": "Hardening"},
        ],
    },
    {
        "name": "Kubernetes Pod", "slug": "kubernetes-pod", "category": "Compute & Containers",
        "node_type": "process", "icon": "box",
        "description": "Kubernetes Pod workload",
        "threats": [
            {"name": "Overly Permissive RBAC", "description": "ServiceAccount has cluster-admin or wildcard permissions beyond what the workload needs.", "category": "Elevation of Privilege", "severity_hint": "critical"},
            {"name": "Missing Network Policies", "description": "No NetworkPolicy resources, allowing all pods to communicate with each other.", "category": "Lateral Movement", "severity_hint": "high"},
            {"name": "Secrets Stored in etcd Plaintext", "description": "Kubernetes Secrets not encrypted at rest in etcd, readable by anyone with etcd access.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Container Image Pull from Untrusted Registry", "description": "Pod spec pulls images from public registries without digest pinning, enabling supply chain attacks.", "category": "Tampering", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Apply Principle of Least Privilege RBAC", "description": "Create dedicated ServiceAccounts with minimal Role bindings for each workload.", "category": "Access Control"},
            {"name": "Define Network Policies", "description": "Create NetworkPolicy resources to restrict ingress/egress to only required services.", "category": "Network Security"},
            {"name": "Enable etcd Encryption at Rest", "description": "Configure EncryptionConfiguration to encrypt Secrets resource in etcd.", "category": "Encryption"},
        ],
    },
    {
        "name": "AWS Lambda", "slug": "aws-lambda", "category": "Compute & Containers",
        "node_type": "process", "icon": "cpu",
        "description": "AWS Lambda serverless function",
        "threats": [
            {"name": "Overly Permissive Lambda Execution Role", "description": "Lambda IAM role has AdministratorAccess or unnecessary service permissions.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Event Injection via Trigger Source", "description": "Untrusted data from SQS, S3 events, or API Gateway passed unsanitized to function logic.", "category": "Tampering", "severity_hint": "high"},
            {"name": "Sensitive Data in Lambda Logs", "description": "Function logs PII, tokens, or secrets to CloudWatch Logs without filtering.", "category": "Information Disclosure", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Create Minimal IAM Execution Role", "description": "Define the smallest IAM policy needed; avoid using AWS-managed PowerUser or Admin policies.", "category": "Access Control"},
            {"name": "Validate and Sanitize All Event Input", "description": "Treat all Lambda event data as untrusted; validate schema and sanitize before processing.", "category": "Input Validation"},
        ],
    },
    # ── Web & Mobile ───────────────────────────────────────────────
    {
        "name": "Web Browser (Client)", "slug": "web-browser", "category": "Web & Mobile",
        "node_type": "external", "icon": "monitor",
        "description": "End-user web browser",
        "threats": [
            {"name": "Cross-Site Scripting (XSS)", "description": "Malicious scripts injected into web pages execute in the victim's browser context.", "category": "Tampering", "severity_hint": "high"},
            {"name": "Cross-Site Request Forgery (CSRF)", "description": "Forged requests from malicious sites execute actions on behalf of authenticated users.", "category": "Spoofing", "severity_hint": "high"},
            {"name": "Clickjacking", "description": "Malicious page embeds target site in iframe, tricking users into clicking hidden elements.", "category": "Spoofing", "severity_hint": "medium"},
            {"name": "Insecure Cookie Attributes", "description": "Session cookies missing Secure, HttpOnly, or SameSite attributes, enabling theft or replay.", "category": "Information Disclosure", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Implement Content Security Policy (CSP)", "description": "Deploy strict CSP headers to prevent inline script execution and restrict script sources.", "category": "Defense in Depth"},
            {"name": "Use CSRF Tokens on State-Changing Requests", "description": "Include unpredictable CSRF tokens in all POST/PUT/DELETE forms and AJAX requests.", "category": "Authentication"},
            {"name": "Set Secure, HttpOnly, SameSite=Strict on Session Cookies", "description": "Configure all session and auth cookies with Secure, HttpOnly, and SameSite=Strict/Lax.", "category": "Session Management"},
        ],
    },
    {
        "name": "Mobile Application", "slug": "mobile-app", "category": "Web & Mobile",
        "node_type": "external", "icon": "smartphone",
        "description": "iOS or Android mobile application",
        "threats": [
            {"name": "Insecure Local Data Storage", "description": "Sensitive data stored in SharedPreferences, NSUserDefaults, or local SQLite without encryption.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Certificate Pinning Bypass", "description": "App does not implement certificate pinning, allowing MITM attacks with custom CA.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Hardcoded API Keys or Secrets", "description": "API keys or credentials compiled into the app binary, extractable via reverse engineering.", "category": "Information Disclosure", "severity_hint": "critical"},
            {"name": "Insecure Deep Link Handling", "description": "App processes deep link parameters without validation, enabling injection or data theft.", "category": "Tampering", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Use Platform Keystore for Secret Storage", "description": "Store secrets in Android Keystore or iOS Keychain; never in SharedPreferences or plist.", "category": "Secrets Management"},
            {"name": "Implement Certificate Pinning", "description": "Pin server certificate or public key hash; handle pin failure gracefully with backup pins.", "category": "Encryption"},
            {"name": "Obfuscate and Strip Secrets from Binary", "description": "Use runtime secret retrieval from secure backend; never hardcode in source or build artifacts.", "category": "Secrets Management"},
        ],
    },
    # ── Monitoring & Observability ─────────────────────────────────
    {
        "name": "Logging Service (ELK, Splunk)", "slug": "logging-service", "category": "Monitoring & Observability",
        "node_type": "process", "icon": "activity",
        "description": "Centralized logging platform",
        "threats": [
            {"name": "Log Injection", "description": "Attacker injects newlines or special characters into log messages to forge audit entries.", "category": "Repudiation", "severity_hint": "medium"},
            {"name": "Sensitive Data in Logs", "description": "PII, tokens, passwords, or credit card numbers logged in plaintext.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Unauthenticated Log Access", "description": "Log aggregator (Kibana, Splunk) accessible without authentication, leaking application internals.", "category": "Information Disclosure", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Sanitize User Input Before Logging", "description": "Strip or escape newlines, control characters, and sensitive patterns before writing to logs.", "category": "Input Validation"},
            {"name": "Implement Log Redaction for Sensitive Fields", "description": "Configure log pipeline to redact or hash PII, tokens, and credential fields.", "category": "Data Minimization"},
        ],
    },
    {
        "name": "CI/CD Pipeline", "slug": "cicd-pipeline", "category": "Monitoring & Observability",
        "node_type": "process", "icon": "git-branch",
        "description": "CI/CD automation pipeline (GitHub Actions, Jenkins, GitLab CI)",
        "threats": [
            {"name": "Secret Exposure in Build Logs", "description": "Environment variables or secrets printed to build output, visible in CI logs.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Dependency Confusion / Supply Chain Attack", "description": "Build installs malicious package from public registry that shadows internal package.", "category": "Tampering", "severity_hint": "critical"},
            {"name": "Overly Permissive Pipeline Credentials", "description": "CI service account has write access to production infrastructure or registries.", "category": "Elevation of Privilege", "severity_hint": "high"},
            {"name": "Untrusted Code Execution via PR", "description": "Pull request from fork triggers CI pipeline with access to repository secrets.", "category": "Elevation of Privilege", "severity_hint": "critical"},
        ],
        "mitigations": [
            {"name": "Use Masked Secrets and Avoid Echoing", "description": "Configure CI to mask secret variables; never echo or print secret values in scripts.", "category": "Secrets Management"},
            {"name": "Pin All Dependencies to Hashes", "description": "Lock all package manager dependencies to specific hashes; enable dependency scanning.", "category": "Supply Chain"},
            {"name": "Restrict Pipeline Triggers from Forks", "description": "Require approval for first-time contributors; use pull_request_target with environment protection.", "category": "Access Control"},
        ],
    },
    # ── Internal Services ──────────────────────────────────────────
    {
        "name": "Internal REST API", "slug": "internal-rest-api", "category": "Internal Services",
        "node_type": "process", "icon": "server",
        "description": "Internal microservice REST API",
        "threats": [
            {"name": "Missing Service-to-Service Authentication", "description": "Internal API accepts requests from any internal service without verifying caller identity.", "category": "Spoofing", "severity_hint": "high"},
            {"name": "Broken Object Level Authorization (BOLA)", "description": "API returns resources of other users when requested with a valid but different user's ID.", "category": "Elevation of Privilege", "severity_hint": "critical"},
            {"name": "Verbose Error Messages", "description": "Stack traces, SQL errors, or internal paths exposed in API error responses.", "category": "Information Disclosure", "severity_hint": "medium"},
        ],
        "mitigations": [
            {"name": "Implement mTLS or Service Mesh Authentication", "description": "Use mutual TLS or a service mesh (Istio, Linkerd) for service-to-service identity verification.", "category": "Authentication"},
            {"name": "Implement Object-Level Authorization Checks", "description": "Verify on every data access that the authenticated user owns or has permission for the requested resource.", "category": "Access Control"},
        ],
    },
    {
        "name": "Email Service (SMTP)", "slug": "email-service", "category": "Internal Services",
        "node_type": "process", "icon": "mail",
        "description": "Email sending service or SMTP relay",
        "threats": [
            {"name": "Email Header Injection", "description": "Unsanitized user input in From, To, or Subject headers enables spam relay or phishing.", "category": "Tampering", "severity_hint": "high"},
            {"name": "Phishing via Transactional Email", "description": "Attacker triggers password reset or verification emails to enumerate valid accounts.", "category": "Spoofing", "severity_hint": "medium"},
            {"name": "Missing SPF/DKIM/DMARC", "description": "Email domain not configured with SPF, DKIM, or DMARC, enabling spoofed emails.", "category": "Spoofing", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Sanitize All Input Used in Email Headers", "description": "Validate and escape newlines, carriage returns from any user-controlled email field.", "category": "Input Validation"},
            {"name": "Configure SPF, DKIM, and DMARC", "description": "Publish SPF records, sign outbound mail with DKIM, and set DMARC policy to reject.", "category": "Email Security"},
        ],
    },
    {
        "name": "File Upload Service", "slug": "file-upload", "category": "Internal Services",
        "node_type": "process", "icon": "upload",
        "description": "Service handling user file uploads",
        "threats": [
            {"name": "Malicious File Upload (Web Shell)", "description": "Attacker uploads executable files (PHP, JSP, .exe) that get served and executed by the server.", "category": "Elevation of Privilege", "severity_hint": "critical"},
            {"name": "Path Traversal via Filename", "description": "Filename containing ../ sequences writes files outside the intended upload directory.", "category": "Tampering", "severity_hint": "critical"},
            {"name": "XML/XXE via Document Upload", "description": "Uploaded XML, SVG, or Office documents contain XXE payloads that read server files.", "category": "Information Disclosure", "severity_hint": "high"},
            {"name": "Missing Virus/Malware Scanning", "description": "Uploaded files not scanned, enabling malware distribution to other users.", "category": "Tampering", "severity_hint": "high"},
        ],
        "mitigations": [
            {"name": "Validate File Type by Content (Magic Bytes)", "description": "Check file content magic bytes, not just extension or MIME type; reject disallowed types.", "category": "Input Validation"},
            {"name": "Store Uploads Outside Web Root with Random Names", "description": "Never serve uploaded files from a path that can be executed; use UUID-based filenames.", "category": "Hardening"},
            {"name": "Scan Uploads with Antivirus Before Storage", "description": "Integrate ClamAV or cloud scanning service for all incoming file uploads.", "category": "Defense in Depth"},
        ],
    },
]


def populate_component_library():
    """Populate the database with Component Threat Library templates."""
    db = SessionLocal()

    try:
        print("Populating Component Threat Library...")

        added = 0
        skipped = 0

        for component_data in COMPONENTS:
            slug = component_data["slug"]
            existing = db.query(ComponentTemplate).filter(
                ComponentTemplate.slug == slug
            ).first()

            if existing:
                print(f"  Skipped (exists): {component_data['name']} ({slug})")
                skipped += 1
                continue

            ct = ComponentTemplate(
                name=component_data["name"],
                slug=slug,
                category=component_data["category"],
                node_type=component_data["node_type"],
                icon=component_data.get("icon"),
                description=component_data.get("description"),
                threats=component_data["threats"],
                mitigations=component_data["mitigations"],
                is_custom=False,
                created_by=None,
            )
            db.add(ct)
            print(f"  Added: {component_data['name']} ({slug})")
            added += 1

        db.commit()

        total = db.query(ComponentTemplate).count()

        print()
        print("=" * 60)
        print("Component Threat Library Population Complete!")
        print("=" * 60)
        print(f"  Added:   {added}")
        print(f"  Skipped: {skipped}")
        print(f"  Total in DB: {total}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\nError: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    populate_component_library()
