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
| ⏱️ **Time** | ~20–25 minutes (a live scan runs 10–15 minutes). |

---

## 🔍 2. How AI-Driven Security Scanning Works

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

## ⚙️ 3. Environment Verification

Before scanning, confirm the AI Security Assistant is installed and connected end-to-end. The request chain you are validating is:

```text
Claude Code CLI  →  LiteLLM proxy (localhost:4000)  →  SAP AI Core  →  LLM (claude-sonnet-5)
```

You will use three terminals in SAP Business Application Studio (BAS). Open each with **Terminal → New Terminal**.

| Terminal | Purpose |
| :---: | --- |
| **Terminal 0** | Run verification commands |
| **Terminal 1** | Run the LiteLLM proxy (stays open) |
| **Terminal 2** | Run Claude Code (stays open) |

---

### 3.1 Check the Pre-Installed Components — Terminal 0

From the workspace root `~/projects/workshop-xp261`, run each command and confirm the expected result.

```bash
# 1. Claude Code CLI is installed
claude --version
#    Expected: a version string, e.g.  2.0.14 (Claude Code)

# 2. LiteLLM proxy is present in its virtual environment
ls litellm-proxy-ai-core/.venv/bin/litellm
#    Expected: the path prints back (the file exists)

# 3. OWASP Scanner plugin is present
ls owasp-scan/skills/SKILL.md
#    Expected: owasp-scan/skills/SKILL.md

# 4. Environment variables are configured
cat litellm-proxy-ai-core/.env
#    Expected: three exports — LITELLM_MASTER_KEY, AICORE_RESOURCE_GROUP, AICORE_SERVICE_KEY
```

> **🔒 Security note:** `.env` holds live SAP AI Core credentials. Do not commit it or share your screen while it is open.

---

### 3.2 Start the LiteLLM Proxy — Terminal 1

The proxy connects Claude Code to SAP AI Core. Start it and leave the terminal running for the whole exercise.

```bash
cd ~/projects/workshop-xp261
./start-litellm.sh
```

**Expected result** — the log ends with the Uvicorn startup banner:

```text
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:4000 (Press CTRL+C to quit)
```

Seeing `Uvicorn running on http://0.0.0.0:4000` means the proxy is listening on **port 4000**.

> **⚠️ Troubleshooting**
> - **`Not logged in to Cloud Foundry`** → the script runs `cf login --sso`. Open the link, copy the one-time passcode, and paste it back.
> - **`Address already in use` (port 4000)** → an old proxy is still running. Run `pkill -9 -f "bin/litellm"` in Terminal 0, then start the script again.

---

### 3.3 Launch Claude Code — Terminal 2

In a third terminal, start Claude Code. It auto-detects the proxy on port 4000.

```bash
cd ~/projects/workshop-xp261
./start-claude.sh
#    Expected: "LiteLLM detected on port 4000"
```

On the **first launch only**, answer four one-time prompts:

| # | Prompt | Your answer |
| :---: | --- | --- |
| 1 | Confirm API key | Type **`Y`** and press Enter |
| 2 | Terminal settings | Accept the recommended **`Shift+Enter`** keybinding |
| 3 | Workspace trust | Select **`Yes, I trust this folder`** |
| 4 | Bypass permissions warning | Select **`Yes, I accept`** |

---

### 3.4 Test the Connection

At the Claude Code prompt, type a short message and press Enter:

```text
Hello
```

**Expected result:** Claude Code replies with a normal greeting. A valid reply proves the full chain works:

```text
Claude Code CLI  →  LiteLLM (port 4000)  →  SAP AI Core  →  LLM
```

> **⚠️ Troubleshooting**
> - **`LiteLLM proxy not detected`** → Terminal 1 is not running. Go back to **3.2** and start it.
> - **`Connection refused`** → the proxy is not reachable. In Terminal 0, run `curl http://127.0.0.1:4000/health/readiness` to confirm it responds.
> - **HTTP 400 (Bad Request)** → a credential issue. Check that `AICORE_SERVICE_KEY` in `.env` is complete (step 3.1), then restart the proxy.

---

### Final State

| Terminal | Command | State |
| :---: | --- | --- |
| **0** | `claude --version`, `ls …`, `cat …` | Idle at the prompt |
| **1** | `./start-litellm.sh` | Running — shows `Uvicorn … 0.0.0.0:4000`. Keep open. |
| **2** | `./start-claude.sh` | Running — prompt active, replies to `Hello`. Keep open. |

> **✅ Environment ready.** All components are installed, the LiteLLM proxy is bridging to SAP AI Core, and Claude Code answers through the full chain. Next, in **Section 4 — Baseline Review**, you'll examine the pre-generated scan findings.


