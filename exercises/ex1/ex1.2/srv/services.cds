// Updated srv/services.cds

using { sap.capire.incidents as my } from '../db/schema';

service ProcessorService {
  @restrict: [
    { grant: ['READ', 'CREATE'], to: 'support' },  // Support can view and create
    { grant: ['UPDATE', 'DELETE'], 
      to: 'support',
      where: 'assignedTo is null or assignedTo = $user'  // Horizontal control for support
    },
    { grant: '*', to: 'admin' }  // ✅ NEW: Explicit full access for admins (CREATE, READ, UPDATE, DELETE)
  ]
  entity Incidents as projection on my.Incidents;
  
  @readonly
    entity Customers as projection on my.Customers;     

}

annotate ProcessorService.Incidents with @odata.draft.enabled; 
annotate ProcessorService with @(requires: 'authenticated-user');

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
