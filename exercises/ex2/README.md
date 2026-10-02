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
 * **Compliance Risk:** Violates [OWASP Top 10 A03](https://owasp.org/Top10/A03_2021-Injection/) and GDPR/PCI DSS requirements for input validation.
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
- ❌ **Lack of Parameterized Queries:** The raw SQL query does not use parameter binding or prepared statements, leaving the query structure exposed to manipulation.

## 💥 3. Exploitation

We will exploit the SQL Injection vulnerability in a local development environment (SAP Business Application Studio with cds watch). Unlike production, key security measures such as real authentication flows, OAuth2 tokens, and data isolation are inactive, allowing ethical hackers to safely simulate attacks, validate vulnerabilities without risking live systems, and rapidly iterate fixes before deploying to production.

### 🪜 Step 1: Review the Test File for the HTTP Endpoint
- ▶️ Action:
  - Navigate to the `test/http` directory in your CAP project folder.
  - Open the file "sql-injection-demo.http".
  
```
@server=http://localhost:4004
@username=incident.support@tester.sap.com // admin role
@password=initial

### ✅ Test 1: Legitimate Customer Lookup
### Action: Normal request with valid customer ID
### Expected: Returns single customer record
### Result: System returns data for customer ID 1004100
GET {{server}}/odata/v4/admin/fetchCustomer
Content-Type: application/json
Authorization: Basic {{username}}:{{password}}

{
  "customerID": "1004100"
}
  
### 🚨 Test 2: SQL Injection True-Clause Attack
### Action: Inject malicious payload ' OR '1'='1
### Expected: Returns ALL customer records
### Result: Full database exposure vulnerability
GET {{server}}/odata/v4/admin/fetchCustomer
Content-Type: application/json
Authorization: Basic {{username}}:{{password}}

{
  "customerID": "1004100' OR '1'='1"
}
... other method

``` 
  
- This file contains three HTTP requests:
  - Test 1: A legitimate request to retrieve a specific customer.
  - Test 2: A malicious request that demonstrates a SQL Injection vulnerability.
  - Test 3: A SQL Injection using multiple SQL statements.

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
  - Open the `sql-injection-demo.http` file in your editor.
  - Confirm in your `package.json` file that the user `incident.support@tester.sap.com` is assigned the `admin` role under the `cds.requires.[development].auth.users` configuration.
  - In `sql-injection-demo.http`, navigate to Test 2 to look up customer information and click on Send Request (added by the editor in the line above the GET statement).
  
``` 
  ### 🚨 Test 2: SQL Injection True-Clause Attack
  ### Action: Inject malicious payload ' OR '1'='1
  ### Expected: Returns ALL customer records
  ### Result: Full database exposure vulnerability
  GET {{server}}/odata/v4/admin/fetchCustomer
  Content-Type: application/json
  Authorization: Basic {{username}}:{{password}}
  {
    "customerID": "1004100' OR '1'='1"
  }
```
- Result:

``` 
  HTTP/1.1 200 OK
  X-Powered-By: Express
  X-Correlation-ID: 06576897-f3fa-4d90-ab7c-bd175dd21abf
  OData-Version: 4.0
  Content-Type: application/json; charset=utf-8
  Content-Length: 950
  Date: Sun, 28 Sep 2025 19:02:26 GMT
  Connection: close
  
  {
    "@odata.context": "$metadata#Customers",
    "value": [
      {
        "createdAt": "2025-09-28T19:02:19.936Z",
        "createdBy": "anonymous",
        "modifiedAt": "2025-09-28T19:02:19.936Z",
        "modifiedBy": "anonymous",
        "ID": "1004155",
        "firstName": "Daniel",
        "lastName": "Watts",
        "name": "Daniel Watts",
        "email": "daniel.watts@demo.com",
        "phone": "+39-555-123",
        "creditCardNo": "4111111111111111"
      },
      {
        "createdAt": "2025-09-28T19:02:19.936Z",
        "createdBy": "anonymous",
        "modifiedAt": "2025-09-28T19:02:19.936Z",
        "modifiedBy": "anonymous",
        "ID": "1004161",
        "firstName": "Stormy",
        "lastName": "Weathers",
        "name": "Stormy Weathers",
        "email": "stormy.weathers@demo.com",
        "phone": "+49-020-022",
        "creditCardNo": "5500000000000004"
      },
      {
        "createdAt": "2025-09-28T19:02:19.936Z",
        "createdBy": "anonymous",
        "modifiedAt": "2025-09-28T19:02:19.936Z",
        "modifiedBy": "anonymous",
        "ID": "1004100",
        "firstName": "Sunny",
        "lastName": "Sunshine",
        "name": "Sunny Sunshine",
        "email": "sunny.sunshine@demo.com",
        "phone": "+49-555-789",
        "creditCardNo": "3400000000000094"
      }
    ]
  }  

``` 

✅ Exploitation Successful: The application returned the entire contents of the Customers table instead of just the record for customer ID 1004100.

    
### 📌Critical Vulnerability Summary
- ❌ **Complete Data Breach:** Any authenticated user can extract the entire contents of the customer table.
- ❌ **Insecure SQL Concatenation:** The services.js code uses direct string concatenation ('${customerID}') to build an SQL query instead of using parameterized queries.
- ❌ **Lack of Input Sanitization:** No validation or sanitization is performed on the customerID input parameter before it is used in the SQL query.

## 🛡️ 4. Remediation
Now that you've identified the SQL Injection vulnerability, let's fix it by implementing secure database queries using CAP's built-in protections.
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

- Open the sql-injection-demo.http file.
- Execute the **Test 1: Legitimate Request** by clicking on "Send Request" above line 17:

```
GET http://localhost:4004/odata/v4/admin/fetchCustomer
Content-Type: application/json
Authorization: Basic incident.support@tester.sap.com:initial
{
  "customerID": "1004100"
}
```
- ✅ Result:
  - The system returns a single customer record for ID = 1004100.
  - This confirms that legitimate functionality remains intact after the fix.

### 🪜 Step 2: Test Basic SQL Injection (True-Clause Attack)
- ▶️ Action:
  - Execute the **Test 2: Basic SQL Injection** by clicking on "Send Request" above line 29:
```
  GET http://localhost:4004/odata/v4/admin/fetchCustomer
  Content-Type: application/json
  Authorization: Basic incident.support@tester.sap.com:initial
  {
    "customerID": "1004100' OR '1'='1"
  }
```
- Result:
```
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
```
- ✅ Empty array [] returned.
- ✅ The malicious payload ' OR '1'='1 is treated as a literal string value rather than executable SQL.
- ✅ This confirms that the SQL Injection vulnerability has been successfully mitigated.

### 🪜 Step 3: SQL Injection -  multiple sql statements
- ▶️ Action: Execute the **Test 3** by clicking on "Send Request" above line 42:

```
  GET  {{server}}/odata/v4/admin/fetchCustomer
  Content-Type: application/json
  Authorization: Basic {{username}}:{{password}}

  {
     "customerID": "1004100'; SELECT * from sap_capire_incidents_Customers;-- "
  }
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


