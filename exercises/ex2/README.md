# Exercise 2 - SQL Injection
Vulnerability: [A03:2021-Injection](https://owasp.org/Top10/A03_2021-Injection/)

## Table of Contents
- [📖 1. Overview](./README.md#--1-overview-)
- [🚨 2. Vulnerable Code](./README.md#-2-vulnerable-code)
- [💥 3. Exploitation](./README.md#-3-exploitation)
- [🛡️ 4. Remediation](./README.md#%EF%B8%8F-4-remediation)
- [✅ 5. Verification](./README.md#-5-verification)
- [📌 6. Summary](./README.md#-6-summary)

## 📖  1. Overview

This exercise demonstrates how unsanitized user inputs can be exploited to perform SQL Injection attacks, thereby compromising the integrity and confidentiality of enterprise data. In the incident management application that you already know from the previous exercises, input fields - such as those accepting the customer ID - are vulnerable if not properly validated. As a result, attackers might inject malicious SQL code to retrieve, alter, or delete sensitive records without detection.
In this exercise you will test the application locally in the development environment. Instead of building and deploying the application to SAP BTP, you will use `cds watch` to launch a local server.

### 📐Business Rules

  - ❌ Users must not exploit insecure input fields to inject or modify SQL queries.
  - ⚠️ All user input must be rigorously validated and sanitized to prevent SQL Injection.

### ⚠️ Why This Matters

 * **Business Impact:** Successful SQL Injection attacks can compromise the integrity and confidentiality of critical data, leading to unauthorized data disclosure, manipulation, or deletion.
 * **Compliance Risk:** Violates [OWASP Top 10 A05 - Injection](https://top10.owasp.org/2025/A05_2025-Injection/) and GDPR/PCI DSS requirements for input validation.
 * **Security Risk:** Malicious actors could exfiltrate sensitive data (e.g., credit card numbers) or bypass authorization controls.

### 🎯 Key Learning Objectives

- Understand how SQL Injection works and how unsafe handling of input can be exploited.
- Learn to use CAP’s safe query APIs (parameterized queries) to prevent SQL Injection.
- Test the remediation to confirm that malicious input is neutralized while legitimate application functionality remains intact.

## 🚨 2. Vulnerable Code
We’ll build upon [Exercise 1.2 - Vertical Privilege Escalation](../ex1/ex1.2/README.md)  by introducing an SQL Injection vulnerability resulting from unsanitized user input.

### What We're Adding

1. **CDS Service Definition (srv/services.cds):** A new **fetchCustomer** function in AdminService that accepts unvalidated input
2. **Vulnerable Implementation (srv/services.js):** Raw SQL query with direct string insertion

**File:** srv/services.cds
- The **services.cds** file includes a new function called **fetchCustomer** in the AdminService. This function is intentionally designed to be vulnerable to SQL Injection for demonstration purposes.

- Ensure the following ode is included in the file:

```
... Other methods

annotate ProcessorService.Incidents with @odata.draft.enabled; 
annotate ProcessorService with @(requires: ['support', 'admin']);  // ✅ NEW: Allow both roles support and admin at service level.

/**
 * Service used by administrators to manage customers and incidents.
 */
service AdminService {
    entity Customers as projection on my.Customers;
    entity Incidents as projection on my.Incidents;

    // ❌ OWASP A03: SQL Injection — both query methods are vulnerable
    @tags: ['security', 'vulnerable']
    function fetchCustomer(
        customerID: String,
        method: String    // concat (default), tagged — both vulnerable to injection
    ) returns array of Customers;
}

annotate AdminService with @(requires: 'admin');

```

**File:** srv/services.js
- The **services.js** file includes a new function handler for **fetchCustomer** in the AdminService class.
- Ensure the following corrected code is included in the file:

```
const cds = require('@sap/cds');

... Other methods

class AdminService extends cds.ApplicationService {
  init() {
    this.on('fetchCustomer', async (req) => {
      const { customerID, method = 'concat' } = req.data;

      // ❌ VULNERABLE: Direct string concatenation (OWASP A03)
      if (method === 'concat') {
        console.log('⚠️ Using INSECURE string concatenation method.');
        const vulnerableQuery =
          `SELECT * FROM sap_capire_incidents_Customers WHERE ID = '${customerID}'`;
        console.log('❌ Vulnerable query constructed:', vulnerableQuery);
        
        ... Other methods
      }

      // ❌ VULNERABLE: Parenthesized tagged template (OWASP A03)
      if (method === 'tagged') {
        console.log('⚠️ Using INSECURE parenthesized tagged template method.');
        const sql = (strings) => {
          if (typeof strings === 'string') {
            console.log('❌ PARENTHESES DETECTED: strings is plain string, not array!');
            return strings;
          }
        };
        const vulnerableQuery =
          sql(`SELECT * FROM sap_capire_incidents_Customers WHERE ID = '${customerID}'`);
        console.log('❌ Vulnerable query constructed:', vulnerableQuery);

        ... Other methods

      }
        ... Other methods

}
module.exports = { ProcessorService, AdminService }

```

**Why this is vulnerable:**
- ❌ **No Input Validation:** The user-supplied customerID is concatenated directly into the SQL query without validation, making it possible for an attacker to inject malicious SQL code.
❌ **Parenthesized tagged template method:** This approach is also vulnerable because parentheses force immediate evaluation of the template literal into a raw string before it reaches the tag/SQL builder—effectively making it behave like string concatenation and enabling injection.

## 💥 3. Exploitation

We will exploit the SQL Injection vulnerability in a local development environment (SAP Business Application Studio with cds watch). Unlike production, key security measures such as real authentication flows, OAuth2 tokens, and data isolation are inactive, allowing ethical hackers to safely simulate attacks, validate vulnerabilities without risking live systems, and rapidly iterate fixes before deploying to production.

### 🪜 Step 1: Review the Test File for the HTTP Endpoint
- ▶️ Action:
  - Navigate to the `test/http` directory in your CAP project folder.
  - Open the file "fetchCustomer-sqlinject-exploit.http".
  
```
@server = http://localhost:4004
@username = incident.support@tester.sap.com
@password = initial

### SQL INJECTION EXPLOIT — Exercise 2
# =====================================================
# Methods implemented in services.js:
#   - concat  → ❌ vulnerable: interpolates customerID into SQL string
#   - tagged  → ❌ vulnerable: (parenthesized tagged template) helper returns raw SQL string (still injectable)
# =====================================================


### ============================================
### PART A — VULNERABLE (method=concat)
### ============================================

### ✅ Test A1: Legitimate Request (concat) → expect 1 row
GET {{server}}/odata/v4/admin/fetchCustomer(customerID='1004100',method='concat')
Authorization: Basic {{username}}:{{password}}

### 🚨 Test A2: True-clause injection (concat)
### Action: Inject malicious payload ' OR '1'='1 (always true)
### Expected: Returns ALL customer records
### Result: Full database exposure vulnerability
GET {{server}}/odata/v4/admin/fetchCustomer(customerID='1004100'' OR ''1''=''1',method='concat')
Authorization: Basic {{username}}:{{password}}

... other method

### 🚨 Test B2: True-clause injection (tagged) → may return many/all rows
GET {{server}}/odata/v4/admin/fetchCustomer(customerID='1004100'' OR ''1''=''1',method='tagged')
Authorization: Basic {{username}}:{{password}}

``` 
  
- This file contains three HTTP requests:
  - Test A1: A legitimate request to retrieve a specific customer.
  - Test A2, Test B2 : A malicious request that demonstrates a SQL Injection vulnerability with methods 'concat' and tagged.

### 🪜 Step 2: Exploit the SQL Injection Vulnerability
- ▶️ Action:
  - Go to the integrated terminal. If you no longer have it open, right-click in the Explorer Pane on the project name to open the context menu. Then select the menu item "Open in Integrated Terminal".
  - Run the following commands from the integrated terminal:

```
  cds build
  cds deploy
  cds watch
```
- Action:
  - Open the `fetchCustomer-sqlinject-exploit.http` file in your editor.
  - Confirm in your `package.json` file that the user `incident.support@tester.sap.com` is assigned the `admin` role under the `cds.requires.[development].auth.users` configuration.
  - In `fetchCustomer-sqlinject-exploit.http`,, navigate to Test A2: True-clause injection (concat) to look up customer information and click on Send Request below line 25.
  
``` 
### 🚨 Test A2: True-clause injection (concat)
### Action: Inject malicious payload ' OR '1'='1 (always true)
### Expected: Returns ALL customer records
### Result: Full database exposure vulnerability
GET {{server}}/odata/v4/admin/fetchCustomer(customerID='1004100'' OR ''1''=''1',method='concat')
Authorization: Basic {{username}}:{{password}}

```
✅ Result:

``` 
[odata] - GET /odata/v4/admin/fetchCustomer(customerID='1004100'' OR ''1''=''1',method='concat') 
⚠️ Using INSECURE string concatenation method.
❌ Vulnerable query constructed: SELECT * FROM sap_capire_incidents_Customers WHERE ID = '1004100' OR '1'='1'
✅ Results count: 3

``` 

✅ Exploitation Successful: The application returned the entire contents of the Customers table instead of just the record for customer ID 1004100.

▶️ Action: Navigate to Test B2: True-clause injection (tagged) to look up customer information and click on Send Request below line 39.

```
### 🚨 Test B2: True-clause injection (tagged) → may return many/all rows
GET {{server}}/odata/v4/admin/fetchCustomer(customerID='1004100'' OR ''1''=''1',method='tagged')
Authorization: Basic {{username}}:{{password}}
```
✅ Result:

```
[odata] - GET /odata/v4/admin/fetchCustomer(customerID='1004100'' OR ''1''=''1',method='tagged') 
⚠️ Using INSECURE parenthesized tagged template method.
❌ PARENTHESES DETECTED: strings is plain string, not array!
❌ Vulnerable query constructed: SELECT * FROM sap_capire_incidents_Customers WHERE ID = '1004100' OR '1'='1'
✅ Results count: 3

```
✅ Exploitation successful:

- Same vulnerability as concat method: ALL customer records returned.
- Parentheses cause immediate template evaluation, defeating the intended parameterization protection.
    
### 📌Critical Vulnerability Summary
- ❌ **Complete Data Breach:** Any authenticated user can extract the entire contents of the customer table.
- ❌ **Insecure SQL Concatenation:** The services.js code uses direct string concatenation ('${customerID}') to build an SQL query instead of using parameterized queries.
- ❌ **Lack of Input Sanitization:** No validation or sanitization is performed on the customerID input parameter before it is used in the SQL query.

## 🛡️ 4. Remediation
Now that you've identified the SQL Injection vulnerability, let's fix it by implementing secure database queries using CAP's built-in protections.

- Copy the contents of [services.cds](./srv/services.cds) into your project’s srv/services.cds file.
- Ensure the following corrected code is included in the file:

'''
  service AdminService {
      entity Customers as projection on my.Customers;
      entity Incidents as projection on my.Incidents;
   
   /* safe    → ✅ SECURE: Parameterized query  */   
   
      function fetchCustomer(
          customerID: String,
          method: String    // method = safe,  Input automatically sanitize
      ) returns array of Customers;
  }
'''

- Copy the contents of [services.js](./srv/services.js) into your project’s srv/services.js file.
- Ensure the following corrected code is included in the file:

```
// ✅ SECURE: Parameterized query using CAP’s fluent API
this.on('fetchCustomer', async (req) => {
  const { customerID } = req.data;

  // ✅ Use parameterized query — input is automatically sanitized
const query = SELECT.from('Customers') // Use the CDS entity name, not the full path
      .where({ ID: customerID });      

  return results;
});

```
- The updated services.js now includes a secure version of the **fetchCustomer** function. 

### Key Changes:
  - ✅ Replaced raw SQL string concatenation with CAP’s SELECT.from().where() syntax.
  - ✅ Input is automatically parameterized and sanitized by the framework.
  - ✅ Eliminates the risk of SQL Injection.

## ✅ 5. Verification
This section outlines the steps to confirm that the remediation for the SQL Injection vulnerability has been successfully implemented. The goal is to verify that:

- Malicious SQL Injection payloads are neutralized and no longer return unauthorized data.
- Legitimate requests continue to function correctly and return expected results.
- The application now correctly uses parameterized queries, preventing any manipulation of the query structure.

### 🪜 Step 1: Test Legitimate Request (Sanity Check)
- ▶️ Action:
  - Stop the current execution of cds watch in the integrated terminal with Ctrl-C. Run the following commands from integrated terminal:

```
  cds build
  cds deploy
  cds watch
```
* 💡**Note:** Ensure the deployment includes the updated [services.js](./srv/services.js) file with the secure parameterized query implementation.

- Open the fetchCustomer-sqlinject-remediate.http file.
- Execute the **Test C1: Legitimate Request** by clicking on "Send Request" above line 16:

```
GET http://localhost:4004/odata/v4/admin/fetchCustomer
Content-Type: application/json
Authorization: Basic incident.support@tester.sap.com:initial
{
  "customerID": "1004100"
}

[odata] - GET /odata/v4/admin/fetchCustomer 
✅ Using SECURE parameterized query method.
✅ Secure parameterized query constructed (input treated as literal parameter)
✅ Results count: 1

```
- ✅ Result:
- The system returns a single customer record for ID = 1004100.
- This confirms that legitimate functionality remains intact after the fix.

### 🪜 Step 2: Test Basic SQL Injection (True-Clause Attack)
- ▶️ Action:
  - Execute the **Test C2: Injection attempt (safe)** by clicking on "Send Request" above line 26:
```
  GET http://localhost:4004/odata/v4/admin/fetchCustomer
  Content-Type: application/json
  Authorization: Basic incident.support@tester.sap.com:initial
  {
    "customerID": "1004100' OR '1'='1"
  }

  HTTP/1.1 200 OK  
  X-Powered-By: Express  
  X-Correlation-ID: 5dea2017-7c3a-46cd-9e45-0b119edce4ff  
  OData-Version: 4.0  
  Content-Type: application/json; charset=utf-8  
  Content-Length: 51  
  Date: Sun, 28 Sep 2025 19:45:56 GMT  
  Connection: close  
  
  {
    "@odata.context": "$metadata#Customers",
    "value": []
  }

  [odata] - GET /odata/v4/admin/fetchCustomer 
  ✅ Using SECURE parameterized query method.
  ✅ Secure parameterized query constructed (input treated as literal parameter)
  ✅ Results count: 0

```
- ✅ Result:
  - Empty array [] returned.
  - The malicious payload ' OR '1'='1 is treated as a literal string value rather than executable SQL.
  - This confirms that the SQL Injection vulnerability has been successfully mitigated.

### 🪜 Step 3: SQL Injection -  multiple sql statements
- ▶️ Action: Execute the **Test C3** by clicking on "Send Request" above line 42:

```
### 🛡️ Test C3: Multi-statement attempt (safe) → expect 0 rows (treated as literal parameter)
[odata] - GET /odata/v4/admin/fetchCustomer(customerID='1004100''; DELETE FROM sap_capire_incidents_Customers;--',method='safe') 
✅ Using SECURE parameterized query method.
✅ Secure parameterized query constructed (input treated as literal parameter)
✅ Results count: 0

```
- ✅ Result:
  - All malicious payloads fail to return unintended data or alter query behavior.
  - The application either returns no results or a validation error, confirming comprehensive protection.

### 📌 Verification Summary
The remediation successfully addresses the SQL Injection vulnerability by:
- **Eliminating String Concatenation:** Replaced unsafe SQL string building with CAP’s parameterized query API (SELECT.from().where({...})).
- **Neutralizing Malicious Inputs:** Attack payloads (e.g., ' OR '1'='1) are treated as data values, not executable code.
- **Preserving Legitimate Functionality:** Valid requests continue to work as expected without disruption.
- **Leveraging Framework Security:** CAP’s built-in query translation to CQN (Core Query Language) and parameter binding prevent SQL Injection at runtime.

## 📌 6. Summary

### 🔑 Key Take‑Aways (SAP CAP Recommendations)
Whenever there’s user input involved:
  - 1. **Never use string concatenation when constructing queries!** Use parameterized APIs (e.g., CAP’s SELECT.from().where()) to ensure user input is treated as data, not executable code.
  - 2. **Never surround tagged template strings with parentheses!** The parentheses `(${userInput})` force JavaScript to evaluate the template literal as a raw string before it reaches the SQL parser. The malicious input becomes part of the SQL command: `WHERE id = (1; DROP TABLE users--)`.

- In this exercise, you have learned how to:
  
  - **Identify SQL Injection Vulnerabilities:** Recognize unsafe patterns like direct string interpolation in queries.
  - **Implement Parameterized Queries:** Use CAP’s API `SELECT.from().where()` to securely handle user input.
  - **Test Remediation:** Verify the fix via the HTTP endpoint by testing that valid inputs succeed and SQL Injection attempts are blocked.

- 🎉 **Congratulations!**
    You have successfully remediated the  [A03:2021-Injection](https://owasp.org/Top10/A03_2021-Injection/) vulnerability and fortified your application against one of the most critical security risks. Your application now follows secure coding best practices that prevent attacker-controlled input from compromising your database. 

👉 Next up: [Exercise 3 - Security Logging and Monitoring Failures](../ex3/README.md), where we address critical [OWASP Top 10 2021 list (A09)](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/) risks by implementing CAP's audit logging framework to detect unauthorized data access, track sensitive information flow, and ensure regulatory compliance through comprehensive security monitoring in enterprise environments.


