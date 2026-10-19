const cds = require('@sap/cds')

class ProcessorService extends cds.ApplicationService {
  /** Registering custom event handlers */
  init() {
    this.before("UPDATE", "Incidents", (req) => this.onUpdate(req));
    this.before("CREATE", "Incidents", (req) => this.changeUrgencyDueToSubject(req.data));

    return super.init();
  }

  changeUrgencyDueToSubject(data) {
    if (data) {
      const incidents = Array.isArray(data) ? data : [data];
      incidents.forEach((incident) => {
        if (incident.title?.toLowerCase().includes("urgent")) {
          incident.urgency = { code: "H", descr: "High" };
        }
      });
    }
  }

  /** Custom Validation */
  async onUpdate (req) {
    const { status_code } = await SELECT.one(req.subject, i => i.status_code).where({ID: req.data.ID})
    if (status_code === 'C')
      return req.reject(403, 'Cannot modify a closed, incident');
  }
}

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
        try {
          const results = await cds.run(vulnerableQuery);
          console.log('✅ Results count:', results.length);
          return results;
        } catch (error) {
          console.error('❌ Error:', error.message);
          return req.error(400, 'Invalid customer identifier');
        }
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
        try {
          const results = await cds.run(vulnerableQuery);
          console.log('✅ Results count:', results.length);
          return results;
        } catch (error) {
          console.error('❌ Error:', error.message);
          return req.error(400, 'Invalid customer identifier');
        }
      }

      return req.error(400, `Unknown method: ${method}. Available: concat, tagged`);
    });
    return super.init();
  }
}
module.exports = { ProcessorService, AdminService }
