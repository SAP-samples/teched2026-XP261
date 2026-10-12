
## Verify the AI Security Assistant Environment

All AI tooling — Claude Code CLI, the LiteLLM proxy, and the OWASP Scanner plugin — are **pre-installed** in your BAS Dev Space. The following steps verify that every component is operational before proceeding to the exercises.

### Step 1 — Verify Pre-installed Components

Open the integrated terminal in BAS and run the following verification commands:

1. **Verify Claude Code CLI:**

```bash
claude --version
```

**Expected result:** A version string such as `2.1.278 (Claude Code)`. Any version 2.x or higher confirms the CLI is installed.

2. **Verify LiteLLM proxy:**

```bash
ls ~/projects/workshop-xp261/litellm-proxy-ai-core/.venv/bin/litellm
```

**Expected result:** The file path is listed without errors. This confirms the Python virtual environment and LiteLLM binary are present.

3. **Verify the OWASP Scanner plugin:**

```bash
ls ls ~/projects/workshop-xp261/owasp-scan/skills/SKILL.md
```

**Expected result:** The file path is listed. This confirms the scanner plugin and its agent files, reference material, and templates are in place.

4. **Verify the environment configuration:**

```bash
cat ~/projects/workshop-xp261/litellm-proxy-ai-core/.env
```

**Expected result:** The file contains three `export` statements for `LITELLM_MASTER_KEY`, `AICORE_RESOURCE_GROUP`, and `AICORE_SERVICE_KEY`. These variables connect the proxy to SAP AI Core.

> If any of the above checks fail, notify your session instructor before continuing.

### Step 2 — Start the LiteLLM Proxy Server

Open a **new terminal** (Terminal 1) and start the local proxy:

```bash
cd ~/projects/workshop-xp261
./start-litellm.sh
```

The script will prompt for Cloud Foundry SSO authentication if needed, then start the proxy. Wait until you see:

```
LiteLLM: Proxy initialized with Config, Set models:
    claude-sonnet-5
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:4000 (Press CTRL+C to quit)
```

**Expected result:** The proxy starts without errors and displays the `Uvicorn running` message. Note the port number displayed — the Claude Code launch script detects it automatically.

Keep this terminal running. Do not close it.

### Step 3 — Launch Claude Code and Verify Connectivity

Open a **new terminal tab** (Terminal 2) and start Claude Code:

```bash
cd ~/projects/workshop-xp261
./start-claude.sh
```

The script automatically sources the environment configuration, detects the LiteLLM proxy port, and launches Claude Code. On **first launch only**, Claude Code presents four one-time prompts:

#### Step 3.1 — Confirm API Key

Claude Code detects the LiteLLM master key from the environment and asks for confirmation.

```
Do you want to use this API KEY?
ANTHROPIC_API_KEY: sk-4063...ffe412

[Y/n]: Y
```

**Action:** Press **Enter** to confirm (default is Y).

#### Step 3.2 — Terminal Settings

```
For the optimal coding experience, enable the recommended settings
for your terminal: Shift+Enter for newlines

  > 1. Yes, use recommended settings
    2. No, maybe later with /terminal-setup

Enter to confirm
```

**Action:** Select **1. Yes, use recommended settings** and press **Enter**.

#### Step 3.3 — Trust the Workspace

```
Accessing workspace:

  /home/user/projects/workshop-xp261

  Quick safety check: Is this a project you created or one you trust?
  Claude Code will be able to read, edit, and execute files here.

    No, exit
  > Yes, I trust this folder
```

**Action:** Select **Yes, I trust this folder** and press **Enter**.

#### Step 3.4 — Bypass Permissions Warning

Because the script uses `--dangerously-skip-permissions`, Claude Code displays a safety warning. This mode is intentional for the workshop sandbox environment.

```
WARNING: Claude Code running in Bypass Permissions mode

  Claude Code will not ask for your approval before running potentially
  dangerous commands. This mode should only be used in a sandboxed
  environment that can easily be restored if damaged.

    No, exit
  > Yes, I accept
```

**Action:** Select **Yes, I accept** and press **Enter**.

> These four prompts appear **one time only**. Subsequent launches skip directly to the Claude Code prompt.

#### Step 3.5 — Verify End-to-End Connectivity

In the Claude Code prompt, type:

```
Hello
```

**Expected result:** Claude Code responds with a greeting. This confirms the full chain is operational: Claude Code CLI → LiteLLM proxy → SAP AI Core → LLM response.

If you receive an error such as `API Error: 400` or `Connection refused`, verify that Terminal 1 (LiteLLM) is still running and retry.

### Terminal Layout Verification

At this point you should have three terminals open:

| Terminal | Purpose | How to verify |
|----------|---------|---------------|
| Terminal 0 | Primary shell (setup, builds) | Prompt shows `user: workshop-xp261 $` |
| Terminal 1 | LiteLLM proxy | Displays `Uvicorn running on http://0.0.0.0:4000` |
| Terminal 2 | Claude Code | Displays the Claude Code prompt (`>`) and responded to "Hello" |

**Expected result:** All three terminals are active. Terminal 1 shows continuous proxy logs. Terminal 2 shows the Claude Code interface ready for input.

---
## Review Pre-Generated AI Security Scan Results

Before the workshop, an AI-powered security scan was executed against the vulnerable `secure_incident_management` codebase using the OWASP Scanner plugin for Claude Code. The scan results are **pre-populated** in your workspace to save session time and ensure consistent findings across all participants.

> **Why pre-generated?** A live AI scan takes 5-8 minutes and produces variable results depending on LLM response timing. Pre-generating the report ensures every participant starts from the same baseline and can immediately focus on understanding the findings rather than waiting for a scan to complete.

When the scan completed, Claude Code displayed the following summary in the terminal:

```
  OWASP Security Scan Complete

  Target: secure_incident_management (SAP CAP / BTP incident management app)
  Date: 2026-09-29
  Output: .owasp-scan/ directory — 10 files generated, all validated

  Final Results: 8 Findings

  The scan identified **8 security findings** across 8 OWASP Top 10 (2025) categories. Review the findings table below:

```

| # | Severity   | Finding | OWASP Category | Component |
|:-:|:---------|---------|---------------|-----------|
| 1 | 🔴 Critical | SQL Injection via raw string concatenation in `fetchCustomer` | **A05 Injection** | Backend (`srv/services.js`) |
| 2 | 🔴 Critical | Missing row-level access control on Incidents — any support user sees all records | **A01 Broken Access Control** | Backend (`srv/services.cds`) |
| 3 | 🔴 Critical | Hardcoded mock credentials and auth bypass (`password: "initial"` in `package.json`) | **A07 Authentication Failures**, **A02 Security Misconfiguration** | Configuration (`package.json`) |
| 4 | 🟠 High   | Pre-built `.mtar` binary artifacts committed to the repository | **A03 Supply Chain Failures** | Repository (`mta_archives/`) |
| 5 | 🔴 Critical | PII and credit card data stored and served without encryption | **A04 Cryptographic Failures** | Database (`db/schema.cds`) |
| 6 | 🟡 Medium   | No structured security logging or alerting — zero audit trail | **A09 Logging & Alerting Failures** | Backend (`srv/services.js`) |
| 7 | 🟡 Medium   | Dev sandbox CDN scripts loaded without Subresource Integrity (SRI) | **A08 Data Integrity Failures** | Frontend (`webapp/index.html`) |
| 8 | 🟡 Medium   | No rate limiting or brute-force protection on any endpoint | **A06 Insecure Design** | Backend (`srv/services.js`) |

**Severity Summary:** 4 Critical, 1 High, 3 Medium

```
 Top Priorities

  1. Fix the SQL injection immediately — srv/services.js fetchCustomer has two
     deliberately vulnerable code paths with a working exploit. Replace raw SQL
     with CAP's parameterized query API.
  2. Add row-level security — ProcessorService.Incidents exposes every incident
     to any support user. Add @restrict with a where clause.
  3. Remove hardcoded credentials — password: "initial" in package.json must be
     moved out of source control.
  4. Encrypt/mask creditCardNo — PCI-sensitive field stored and served as
     plain text.
```

The sections below walk through the generated report files in detail.

### Step 1 — Locate the Scan Results

In the BAS Explorer, expand the following path:

```
secure_incident_management/
  └── .owasp-scan/
        ├── 2026-09-29_secure_incident_management_FINDINGS.md
        ├── 2026-09-29_secure_incident_management_FINDINGS.json
        ├── 2026-09-29_secure_incident_management_FINDINGS_VALIDATED.json
        ├── 2026-09-29_secure_incident_management_FINDINGS_VALIDATION_REPORT.json
        ├── 2026-09-29_secure_incident_management_LANDSCAPE.json
        ├── 2026-09-29_secure_incident_management_LANDSCAPE.md
        ├── 2026-09-29_secure_incident_management_REVIEWED_FINDINGS.md          ← primary report
        ├── 2026-09-29_secure_incident_management_REVIEWED_FINDINGS.json
        ├── 2026-09-29_secure_incident_management_REVIEWED_FINDINGS_FINAL.json
        └── 2026-09-29_secure_incident_management_REVIEWED_FINDINGS_VALIDATED.json
```

**Expected result:** The `.owasp-scan` folder contains 10 files. If the folder is missing or empty, notify your session instructor.

> **Note:** The full report contains detailed evidence for each finding, including exact file paths, line numbers, code snippets, attack preconditions, and remediation recommendations. Take a few minutes to read through the detailed descriptions in the `.md` file.

### Step 2 — Open the Reviewed Findings Report

Click on **`2026-09-29_secure_incident_management_REVIEWED_FINDINGS.md`** to open the curated security report. This is the final output of the three-phase AI scan pipeline:

| Phase | Name | Purpose |
|-------|------|---------|
| Phase 1 | **Discovery** | Mapped the codebase architecture: components, data flows, trust boundaries, dependencies |
| Phase 2 | **Analysis** | Scanned the codebase against all 10 OWASP Top 10 (2025) categories with evidence-grounded findings |
| Phase 3 | **Review** | A senior-reviewer pass that verified every finding against the code, removed false positives, and curated the final report |

The review phase consolidated overlapping findings and validated each against the source code. The final report contains **8 confirmed findings** — all validated with code-level evidence.

### Step 3 — Identify the Exercise Targets

Three of the 8 findings map directly to the hands-on exercises you will complete next. These are the vulnerabilities you will learn to exploit and remediate:

| Finding | Severity | OWASP Category | Your Exercise |
|---------|----------|---------------|---------------|
| #2 — Missing row-level access control on Incidents | 🔴 Critical | **A01 Broken Access Control** | [Exercise 1](../ex1/README.md) |
| #1 — SQL Injection via raw string concatenation | 🔴 Critical | **A05 Injection** | [Exercise 2](../ex2/README.md) |
| #6 — No structured security logging or alerting | 🟡 Medium | **A09 Logging & Alerting Failures** | [Exercise 3](../ex3/README.md) |

The remaining 5 findings (hardcoded credentials and auth bypass, pre-built binary artifacts, plaintext PII/credit card data, missing SRI, no rate limiting) are real vulnerabilities documented in the report. They are not covered in the hands-on exercises but represent common security gaps in cloud applications that should be addressed in a production environment.

### How the Scan Was Generated (Reference)

For reference, the pre-populated scan was produced using the following command in the Claude Code terminal:

```
/owasp-analysis
```

This invokes the OWASP Scanner plugin at `owasp-scan/skills/`, which reads the `secure_incident_management` codebase and executes the three-phase pipeline. The command file is located at `.claude/commands/owasp-analysis.md`.

If you wish to **re-run the scan** at any point during the workshop (for example, after applying fixes), delete the existing results and run the command again:

```bash
rm -rf ~/projects/workshop-xp261/secure_incident_management/.owasp-scan/
```

Then in Claude Code:

```
/owasp-analysis
```
