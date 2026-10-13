const cds = require('@sap/cds')

class ProcessorService extends cds.ApplicationService {
  init() {
    // ✅ NEW: Validate business rules
    this.before(['UPDATE', 'DELETE'], 'Incidents', req => this.onModify(req));

    // ✅ NEW: Enrich before CREATE (auto‑assignment + urgency handling)
    this.before("CREATE", "Incidents", req => this.onBeforeCreate(req))

    return super.init()
  }

  /** Helper: Adjust urgency based on incident title text */
  changeUrgencyDueToSubject(data) {
    if (!data) return
    const incidents = Array.isArray(data) ? data : [data]
    incidents.forEach(incident => {
      if (incident.title?.toLowerCase().includes("urgent")) {
        incident.urgency = { code: "H", descr: "High" }
      }
    })
  }

//  ✅ NEW : block updates or deletes for closed incidents */
  async onModify(req) {
    const result = await SELECT.one.from(req.subject)
      .columns('status_code')
      .where({ ID: req.data.ID })

    if (!result) return req.reject(404, 'Not found');
    
    // 'C' : Closed incident
    if (result.status_code === 'C') { 
      const action = req.event === 'UPDATE' ? 'modify' : 'delete'
      return req.error(403, `Cannot ${action} a closed incident`)
    }
  }
  
// ✅ NEW: Before CREATE: Auto‑assign + urgency keyword detection */
  async onBeforeCreate(req) {
    const incident = req.data

    // Auto‑assign if status = 'A' Assigned incident
    if (incident.status_code === 'A' && req.user) {
      incident.assignedTo = req.user.id
      console.log(`📝  Incident auto-assigned to creator`)
    }

    // Adjust urgency based on title
    this.changeUrgencyDueToSubject(incident)
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
