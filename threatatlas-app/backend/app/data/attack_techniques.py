"""Curated subset of the MITRE ATT&CK Enterprise technique catalog.

This is static reference data (the ATT&CK technique list is public, versioned
reference material — not a live feed), bundled so threats can be mapped to
ATT&CK techniques fully offline. A future enhancement can replace this with a
synced copy of the full STIX dataset; the mapping API does not change.

Source: MITRE ATT&CK Enterprise (https://attack.mitre.org/). ATT&CK® is a
registered trademark of The MITRE Corporation.
"""

from __future__ import annotations

# Each entry: technique_id, name, tactic, url, short description.
ATTACK_TECHNIQUES: list[dict] = [
    {"technique_id": "T1190", "name": "Exploit Public-Facing Application", "tactic": "Initial Access",
     "url": "https://attack.mitre.org/techniques/T1190/",
     "description": "Adversaries exploit a weakness in an Internet-facing host or system to gain access."},
    {"technique_id": "T1133", "name": "External Remote Services", "tactic": "Initial Access",
     "url": "https://attack.mitre.org/techniques/T1133/",
     "description": "Adversaries leverage external-facing remote services to access or persist within a network."},
    {"technique_id": "T1078", "name": "Valid Accounts", "tactic": "Defense Evasion",
     "url": "https://attack.mitre.org/techniques/T1078/",
     "description": "Adversaries obtain and abuse credentials of existing accounts to gain access."},
    {"technique_id": "T1110", "name": "Brute Force", "tactic": "Credential Access",
     "url": "https://attack.mitre.org/techniques/T1110/",
     "description": "Adversaries use brute force to guess passwords or keys when credentials are unknown."},
    {"technique_id": "T1059", "name": "Command and Scripting Interpreter", "tactic": "Execution",
     "url": "https://attack.mitre.org/techniques/T1059/",
     "description": "Adversaries abuse command and script interpreters to execute commands or scripts."},
    {"technique_id": "T1203", "name": "Exploitation for Client Execution", "tactic": "Execution",
     "url": "https://attack.mitre.org/techniques/T1203/",
     "description": "Adversaries exploit software vulnerabilities in client applications to execute code."},
    {"technique_id": "T1505", "name": "Server Software Component", "tactic": "Persistence",
     "url": "https://attack.mitre.org/techniques/T1505/",
     "description": "Adversaries abuse server software components (e.g. web shells) to establish persistence."},
    {"technique_id": "T1068", "name": "Exploitation for Privilege Escalation", "tactic": "Privilege Escalation",
     "url": "https://attack.mitre.org/techniques/T1068/",
     "description": "Adversaries exploit software vulnerabilities to elevate privileges."},
    {"technique_id": "T1548", "name": "Abuse Elevation Control Mechanism", "tactic": "Privilege Escalation",
     "url": "https://attack.mitre.org/techniques/T1548/",
     "description": "Adversaries circumvent mechanisms designed to control elevated privileges."},
    {"technique_id": "T1556", "name": "Modify Authentication Process", "tactic": "Defense Evasion",
     "url": "https://attack.mitre.org/techniques/T1556/",
     "description": "Adversaries modify authentication mechanisms to bypass or subvert access controls."},
    {"technique_id": "T1565", "name": "Data Manipulation", "tactic": "Impact",
     "url": "https://attack.mitre.org/techniques/T1565/",
     "description": "Adversaries insert, delete, or manipulate data to influence outcomes or hide activity."},
    {"technique_id": "T1485", "name": "Data Destruction", "tactic": "Impact",
     "url": "https://attack.mitre.org/techniques/T1485/",
     "description": "Adversaries destroy data and files to interrupt availability."},
    {"technique_id": "T1499", "name": "Endpoint Denial of Service", "tactic": "Impact",
     "url": "https://attack.mitre.org/techniques/T1499/",
     "description": "Adversaries perform denial-of-service attacks to degrade or block availability of services."},
    {"technique_id": "T1498", "name": "Network Denial of Service", "tactic": "Impact",
     "url": "https://attack.mitre.org/techniques/T1498/",
     "description": "Adversaries exhaust network bandwidth to deny availability to users."},
    {"technique_id": "T1040", "name": "Network Sniffing", "tactic": "Credential Access",
     "url": "https://attack.mitre.org/techniques/T1040/",
     "description": "Adversaries capture network traffic to obtain credentials or sensitive data."},
    {"technique_id": "T1557", "name": "Adversary-in-the-Middle", "tactic": "Collection",
     "url": "https://attack.mitre.org/techniques/T1557/",
     "description": "Adversaries position between communicating systems to intercept or manipulate traffic."},
    {"technique_id": "T1213", "name": "Data from Information Repositories", "tactic": "Collection",
     "url": "https://attack.mitre.org/techniques/T1213/",
     "description": "Adversaries collect data from shared repositories such as wikis or databases."},
    {"technique_id": "T1530", "name": "Data from Cloud Storage", "tactic": "Collection",
     "url": "https://attack.mitre.org/techniques/T1530/",
     "description": "Adversaries access data objects from improperly secured cloud storage."},
    {"technique_id": "T1567", "name": "Exfiltration Over Web Service", "tactic": "Exfiltration",
     "url": "https://attack.mitre.org/techniques/T1567/",
     "description": "Adversaries exfiltrate data over web services rather than their command channel."},
    {"technique_id": "T1486", "name": "Data Encrypted for Impact", "tactic": "Impact",
     "url": "https://attack.mitre.org/techniques/T1486/",
     "description": "Adversaries encrypt data on target systems (ransomware) to interrupt availability."},
    {"technique_id": "T1496", "name": "Resource Hijacking", "tactic": "Impact",
     "url": "https://attack.mitre.org/techniques/T1496/",
     "description": "Adversaries hijack system resources (e.g. for cryptomining) to the detriment of the victim."},
    {"technique_id": "T1098", "name": "Account Manipulation", "tactic": "Persistence",
     "url": "https://attack.mitre.org/techniques/T1098/",
     "description": "Adversaries manipulate accounts to maintain or elevate access to systems."},
    {"technique_id": "T1071", "name": "Application Layer Protocol", "tactic": "Command and Control",
     "url": "https://attack.mitre.org/techniques/T1071/",
     "description": "Adversaries communicate using application-layer protocols to blend with normal traffic."},
    {"technique_id": "T1006", "name": "Repudiation / Indicator Removal", "tactic": "Defense Evasion",
     "url": "https://attack.mitre.org/techniques/T1070/",
     "description": "Adversaries delete or alter logs and artifacts to repudiate actions and evade detection."},
]

# Indexed by technique_id for O(1) validation/lookup.
TECHNIQUES_BY_ID: dict[str, dict] = {t["technique_id"]: t for t in ATTACK_TECHNIQUES}


def list_tactics() -> list[str]:
    """Distinct tactics, in first-seen order."""
    seen: list[str] = []
    for t in ATTACK_TECHNIQUES:
        if t["tactic"] not in seen:
            seen.append(t["tactic"])
    return seen


def search_techniques(q: str | None = None, tactic: str | None = None) -> list[dict]:
    """Filter the catalog by free-text query (id/name/description) and/or tactic."""
    results = ATTACK_TECHNIQUES
    if tactic:
        results = [t for t in results if t["tactic"].lower() == tactic.lower()]
    if q:
        needle = q.lower()
        results = [
            t for t in results
            if needle in t["technique_id"].lower()
            or needle in t["name"].lower()
            or needle in t["description"].lower()
        ]
    return results
