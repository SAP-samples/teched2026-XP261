using { sap.capire.incidents as my } from '../db/schema';

/**
 * Service used by support personnel, i.e. the incidents' 'processors'.
 */
service ProcessorService {

    @requires: 'support'                               // ❌ VULNERABILITY: 'support' role grants unrestricted access to all operations.
                                                       // ❌ Missing row-level or field-level restrictions exposes sensitive incident data.
    entity Incidents as projection on my.Incidents;    // ❌ 'support' role can access all incidents (read, write, delete) 

    @readonly                                          // ✅ Read-only customers (correct)
    @requires: 'support'
    entity Customers as projection on my.Customers;    // ✅ 'support' role can only read customers (correct)
}

annotate ProcessorService.Incidents with @odata.draft.enabled;
annotate ProcessorService with @(requires: 'authenticated-user');  // ✅ Any logged-in user can load $metadata

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
