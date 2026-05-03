"""Seed data for knowledge base - STRIDE and PASTA frameworks with threats and mitigations."""

FRAMEWORKS = [
    {
        "name": "STRIDE",
        "description": "STRIDE is a threat modeling methodology developed by Microsoft. It stands for Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege."
    },
    {
        "name": "PASTA",
        "description": "Process for Attack Simulation and Threat Analysis (PASTA) is a risk-centric threat modeling methodology that provides a seven-stage process for aligning business objectives and technical requirements."
    }
]

STRIDE_THREATS = [
    {
        "name": "Spoofing Identity",
        "description": "Pretending to be someone or something else",
        "category": "Spoofing"
    },
    {
        "name": "User Impersonation",
        "description": "Attacker impersonates a legitimate user to gain unauthorized access",
        "category": "Spoofing"
    },
    {
        "name": "Data Tampering",
        "description": "Malicious modification of data",
        "category": "Tampering"
    },
    {
        "name": "Code Injection",
        "description": "Injecting malicious code into application (SQL injection, XSS, etc.)",
        "category": "Tampering"
    },
    {
        "name": "Man-in-the-Middle Attack",
        "description": "Intercepting and potentially altering communication between two parties",
        "category": "Tampering"
    },
    {
        "name": "Repudiation of Actions",
        "description": "User denies performing an action without ability to prove otherwise",
        "category": "Repudiation"
    },
    {
        "name": "Information Disclosure",
        "description": "Exposure of information to unauthorized individuals",
        "category": "Information Disclosure"
    },
    {
        "name": "Data Breach",
        "description": "Unauthorized access to sensitive or confidential data",
        "category": "Information Disclosure"
    },
    {
        "name": "Denial of Service (DoS)",
        "description": "Denying service to valid users",
        "category": "Denial of Service"
    },
    {
        "name": "Resource Exhaustion",
        "description": "Consuming all available resources to prevent legitimate use",
        "category": "Denial of Service"
    },
    {
        "name": "Elevation of Privilege",
        "description": "Gaining capabilities without proper authorization",
        "category": "Elevation of Privilege"
    },
    {
        "name": "Privilege Escalation",
        "description": "Exploiting a vulnerability to gain elevated access to resources",
        "category": "Elevation of Privilege"
    }
]

STRIDE_MITIGATIONS = [
    {
        "name": "Multi-Factor Authentication",
        "description": "Implement MFA to verify user identity",
        "category": "Spoofing"
    },
    {
        "name": "Digital Signatures",
        "description": "Use digital signatures to verify authenticity",
        "category": "Spoofing"
    },
    {
        "name": "Input Validation",
        "description": "Validate and sanitize all user inputs",
        "category": "Tampering"
    },
    {
        "name": "Data Integrity Checks",
        "description": "Implement checksums and hash functions to detect tampering",
        "category": "Tampering"
    },
    {
        "name": "Encryption in Transit",
        "description": "Use TLS/SSL to encrypt data during transmission",
        "category": "Tampering"
    },
    {
        "name": "Audit Logging",
        "description": "Maintain comprehensive logs of all actions",
        "category": "Repudiation"
    },
    {
        "name": "Secure Timestamps",
        "description": "Use trusted time sources for all transactions",
        "category": "Repudiation"
    },
    {
        "name": "Data Encryption at Rest",
        "description": "Encrypt sensitive data when stored",
        "category": "Information Disclosure"
    },
    {
        "name": "Access Control Lists (ACLs)",
        "description": "Implement proper access controls to limit data exposure",
        "category": "Information Disclosure"
    },
    {
        "name": "Rate Limiting",
        "description": "Limit the rate of requests to prevent resource exhaustion",
        "category": "Denial of Service"
    },
    {
        "name": "Resource Quotas",
        "description": "Implement quotas to prevent single users from consuming all resources",
        "category": "Denial of Service"
    },
    {
        "name": "Principle of Least Privilege",
        "description": "Grant users only the minimum necessary permissions",
        "category": "Elevation of Privilege"
    },
    {
        "name": "Role-Based Access Control (RBAC)",
        "description": "Implement RBAC to manage user permissions systematically",
        "category": "Elevation of Privilege"
    }
]

PASTA_THREATS = [
    {
        "name": "Business Logic Bypass",
        "description": "Circumventing intended business logic flows",
        "category": "Attack Simulation"
    },
    {
        "name": "API Abuse",
        "description": "Misuse of API endpoints for malicious purposes",
        "category": "Attack Simulation"
    },
    {
        "name": "Session Hijacking",
        "description": "Stealing or predicting session tokens",
        "category": "Attack Simulation"
    },
    {
        "name": "Credential Stuffing",
        "description": "Using stolen credentials from one service on another",
        "category": "Attack Simulation"
    },
    {
        "name": "Cross-Site Scripting (XSS)",
        "description": "Injecting malicious scripts into web pages",
        "category": "Attack Simulation"
    },
    {
        "name": "Cross-Site Request Forgery (CSRF)",
        "description": "Forcing users to execute unwanted actions",
        "category": "Attack Simulation"
    }
]

PASTA_MITIGATIONS = [
    {
        "name": "Business Logic Validation",
        "description": "Implement server-side validation of business rules",
        "category": "Attack Simulation"
    },
    {
        "name": "API Gateway",
        "description": "Use an API gateway to control and monitor API access",
        "category": "Attack Simulation"
    },
    {
        "name": "Secure Session Management",
        "description": "Use secure, random session tokens with proper timeout",
        "category": "Attack Simulation"
    },
    {
        "name": "Password Policy Enforcement",
        "description": "Enforce strong password requirements and detection of compromised passwords",
        "category": "Attack Simulation"
    },
    {
        "name": "Content Security Policy (CSP)",
        "description": "Implement CSP headers to prevent XSS attacks",
        "category": "Attack Simulation"
    },
    {
        "name": "Anti-CSRF Tokens",
        "description": "Use CSRF tokens to validate legitimate requests",
        "category": "Attack Simulation"
    }
]

# ---------------------------------------------------------------------------
# OWASP LLM Top 10 (2025) — https://genai.owasp.org/llm-top-10/
# ---------------------------------------------------------------------------

OWASP_LLM_THREATS = [
    {
        "name": "LLM01: Prompt Injection",
        "description": "Attackers craft malicious inputs that override or manipulate an LLM's system prompt or context window, causing the model to ignore its instructions, leak confidential data, or execute unintended actions. Both direct injection (via user messages) and indirect injection (via poisoned external content retrieved by the LLM) are covered.",
        "category": "Prompt Injection"
    },
    {
        "name": "LLM02: Sensitive Information Disclosure",
        "description": "LLMs may inadvertently reveal confidential information—including personal data, proprietary business logic, or system configuration—through their training data memorisation, overly verbose responses, or misconfigured access controls around retrieval-augmented context.",
        "category": "Information Disclosure"
    },
    {
        "name": "LLM03: Supply Chain Vulnerabilities",
        "description": "LLM pipelines depend on third-party components—pretrained base models, fine-tuning datasets, plugins, vector stores, and external APIs—each of which may introduce vulnerabilities, backdoors, or malicious modifications that are inherited by the final application.",
        "category": "Supply Chain"
    },
    {
        "name": "LLM04: Data and Model Poisoning",
        "description": "Adversaries corrupt the data used to train, fine-tune, or feed (via RAG) an LLM, introducing biases, backdoors, or hidden behaviours. Poisoned models may produce subtly incorrect, harmful, or attacker-controlled outputs in specific trigger conditions.",
        "category": "Data and Model Poisoning"
    },
    {
        "name": "LLM05: Improper Output Handling",
        "description": "When LLM-generated text is passed unsanitised to downstream systems—browsers, shells, databases, or APIs—it can trigger Cross-Site Scripting (XSS), Server-Side Request Forgery (SSRF), code injection, or remote code execution depending on the consuming system.",
        "category": "Improper Output Handling"
    },
    {
        "name": "LLM06: Excessive Agency",
        "description": "LLM agents granted overly broad permissions, capabilities, or access to external tools can take high-impact autonomous actions beyond what is required for their intended purpose, leading to unintended data modifications, service disruptions, or privilege escalation.",
        "category": "Excessive Agency"
    },
    {
        "name": "LLM07: System Prompt Leakage",
        "description": "Attackers induce the LLM to reveal the contents of its confidential system prompt, exposing business logic, safety guardrails, hidden instructions, or proprietary configurations that can be exploited to craft more effective subsequent attacks.",
        "category": "System Prompt Leakage"
    },
    {
        "name": "LLM08: Vector and Embedding Weaknesses",
        "description": "Retrieval-Augmented Generation (RAG) systems rely on vector databases and embedding models that can be manipulated through adversarial document injection, embedding inversion attacks, or access-control gaps, allowing attackers to influence what context is retrieved and fed to the LLM.",
        "category": "Vector and Embedding Weaknesses"
    },
    {
        "name": "LLM09: Misinformation",
        "description": "LLMs can generate plausible-sounding but factually incorrect, misleading, or hallucinated content. When this output is presented without appropriate caveats or human review—especially in high-stakes domains such as healthcare, law, or finance—it can cause direct harm or undermine trust.",
        "category": "Misinformation"
    },
    {
        "name": "LLM10: Unbounded Consumption",
        "description": "Applications that allow unlimited LLM inference requests, excessive context sizes, or runaway agentic loops are vulnerable to Denial-of-Wallet attacks, cost amplification, and service disruption. Adversaries can also exploit these weaknesses for competitive model extraction.",
        "category": "Unbounded Consumption"
    }
]

OWASP_LLM_MITIGATIONS = [
    {
        "name": "Input Validation and Sanitisation",
        "description": "Validate, sanitise, and contextually escape all user-supplied text before passing it to the LLM. Use allow-lists for expected input formats and reject or neutralise attempts to embed instruction-like patterns in user data.",
        "category": "Prompt Injection"
    },
    {
        "name": "Privilege-Separated Prompt Architecture",
        "description": "Clearly demarcate system instructions from user content using structural separators, distinct roles, or separate API calls. Treat user-provided text as untrusted data—never interpolate it directly into privileged instruction blocks.",
        "category": "Prompt Injection"
    },
    {
        "name": "Minimum Necessary Data in Context",
        "description": "Restrict what sensitive information is included in the LLM context window. Apply data classification policies so personally identifiable information, secrets, and confidential business logic are not unnecessarily retrieved or passed to the model.",
        "category": "Information Disclosure"
    },
    {
        "name": "Output Filtering and Redaction",
        "description": "Apply post-processing filters to LLM responses to detect and redact sensitive patterns such as PII, credentials, or internal infrastructure details before responses are returned to users or downstream systems.",
        "category": "Information Disclosure"
    },
    {
        "name": "Supply Chain Integrity Verification",
        "description": "Verify cryptographic checksums or signatures for all model weights, datasets, and third-party plugins before use. Prefer models and components sourced from audited, reputable providers with published transparency reports.",
        "category": "Supply Chain"
    },
    {
        "name": "Training Data Provenance and Auditing",
        "description": "Maintain a complete audit trail for all data used in pre-training, fine-tuning, and RAG pipelines. Implement anomaly detection to identify unexpected distributions or patterns in datasets that may indicate poisoning.",
        "category": "Data and Model Poisoning"
    },
    {
        "name": "LLM Output Encoding for Downstream Systems",
        "description": "Treat all LLM output as untrusted input when passing it to downstream components. Apply context-appropriate encoding (HTML escaping, shell quoting, parameterised queries) before the output is rendered, executed, or stored.",
        "category": "Improper Output Handling"
    },
    {
        "name": "Least-Privilege Agent Permissions",
        "description": "Grant LLM agents only the minimum permissions, tool access, and data scopes required to complete their intended tasks. Implement explicit action allow-lists and require human-in-the-loop confirmation for high-impact or irreversible operations.",
        "category": "Excessive Agency"
    },
    {
        "name": "System Prompt Confidentiality Controls",
        "description": "Do not rely solely on the LLM to keep system prompts secret. Store sensitive instructions outside the context window where possible, monitor outputs for prompt leakage patterns, and treat system prompt contents as potentially observable by determined adversaries.",
        "category": "System Prompt Leakage"
    },
    {
        "name": "RAG Access Control and Document Isolation",
        "description": "Apply row-level and document-level access controls to vector stores so that retrieval is scoped to what the requesting user is authorised to read. Implement namespace isolation and content-integrity checks to detect injected adversarial documents.",
        "category": "Vector and Embedding Weaknesses"
    },
    {
        "name": "Grounding and Source Attribution",
        "description": "Ground LLM responses against authoritative, verified knowledge sources and provide citations so users can evaluate accuracy independently. Clearly label AI-generated content and implement confidence thresholds below which human review is required.",
        "category": "Misinformation"
    },
    {
        "name": "Rate Limiting and Token Budget Controls",
        "description": "Enforce per-user, per-session, and per-application token limits and request rate caps. Set maximum context sizes and output lengths. Implement cost alerts and hard budget ceilings to prevent runaway consumption and Denial-of-Wallet attacks.",
        "category": "Unbounded Consumption"
    }
]
