# Exercise 4 — Validate Security with the AI OWASP Scanner Assistant

## Contents

1. [📖 Overview](#-1-overview)
2. [🔍 How AI-Driven Security Scanning Works](#-2-how-ai-driven-security-scanning-works)
3. [⚙️ Environment Verification](#-3-environment-verification)
4. [📂 Baseline Review](#-4-baseline-review)
5. [🔄 Post-Remediation Live Verification](#-5-post-remediation-live-verification)
6. [🏁 Summary & Next Steps](#-6-summary--next-steps)

---

## 📖 1. Overview

Welcome to the final exercise. Here you move from *fixing* vulnerabilities to *proving* they are fixed — using the AI OWASP Scanner Assistant to independently validate the work you did in Exercises 1–3.

### 🎯 Key Learning Objectives

- Understand the four-phase AI scanning pipeline behind the OWASP Scanner Assistant.
- Verify that the **AI Security Assistant environment** is operational and connected end-to-end to SAP AI Core.
- Run a **live OWASP scan** to prove your Exercise 1–3 fixes (A01, A05, A09) actually closed the vulnerabilities.
- Read a security report critically — distinguishing confirmed fixes from **accepted risks** and out-of-scope findings.

| | |
| --- | --- |
| 🧩 **Application under test** | `secure_incident_management` — an SAP **CAP · Node.js · HANA · XSUAA** incident-management app. |
| ✅ **Prerequisite** | Exercises 1–3 complete: **A01** Broken Access Control, **A05** Injection, and **A09** Logging & Alerting Failures remediated. |
| ⏱️ **Time** | ~20–25 minutes (a live scan runs 5–8 minutes). |

---

## 2. How AI-Driven Security Scanning Works

This workshop uses the **AI OWASP Scanner Assistant** — a Claude Code plugin (at `owasp-scan/skills/`) that reasons about your code *with evidence*, assessing it against the **OWASP Top 10 (2025)**. You invoke it from the Claude Code prompt with a single command:

```text
/owasp-analysis
```

It runs a **four-stage, evidence-grounded pipeline**. Each stage is a focused subagent that writes its output into the project's `.owasp-scan/` folder before the next stage begins:

```text

    /owasp-analysis
           │
           ▼
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ Phase 1            │     │ Phase 2            │     │ Phase 3            │     │ Phase 4            │
│ DISCOVERY          │     │ ANALYSIS           │     │ REVIEW             │     │ POLICY EXCLUSIONS  │
│ Architect          │ ──> │ Security Expert    │ ──> │ Senior Reviewer    │ ──> │ Accepted-risk pass │
│ LANDSCAPE          │     │ FINDINGS           │     │ REVIEWED + HTML    │     │ Final report       │
└────────────────────┘     └────────────────────┘     └────────────────────┘     └────────────────────┘
```

| Phase | Role | What happens |
| :---: | --- | --- |
| **1 · Discovery** | Software Architect |Identifies the app's components, data flows, trust boundaries, and technologies. Every finding points to the actual file where it was found. |
| **2 · Analysis** | Security Expert | One thorough pass over all ten categories (A01–A10). **No finding without evidence** (file + line). Severity comes from the criticality matrix — never "by feel." |
| **3 · Review** | Senior Reviewer | Re-verifies each finding against the code, removes false positives, and **deduplicates** overlapping issues. Emits Markdown, JSON, and an interactive HTML report. |
| **4 · Policy Exclusions** | Accepted-risk pass | Removes findings that match the documented accepted risks in `policy-exclusions.md` and logs them for audit. |

> **🔍 Validation gate:** Between Phase 2 and Phase 3, a script (`validation/validate.py`) checks every finding against a JSON schema for structure, risk-score consistency, and component grounding. Anything that fails is dropped — so the final report contains only evidence-backed findings.

**How severity is decided.** Criticality is a deterministic lookup of **Impact × Ease of Attack**, so two reviewers (or two scans) rate the same issue the same way:

| Impact \ Ease | Very Complex | Complex | Advanced | Easy |
| --- | :---: | :---: | :---: | :---: |
| **Severe** | High | High | **Critical** | **Critical** |
| **Significant** | Medium | Medium | High | **Critical** |
| **Moderate** | Low | Medium | Medium | High |
| **Minor** | Low | Low | Medium | Medium |

> **✅ You now have the mental model.** Next, in **Section 2 — Environment Verification**, you'll confirm the assistant that runs this pipeline is live and connected to SAP AI Core.
