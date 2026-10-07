const cds = require('@sap/cds');

class ProcessorService extends cds.ApplicationService {
  init() {
    // ✅ Validate business rules
    this.before(['UPDATE', 'DELETE'], 'Incidents', req => this.onModify(req));

    // ✅ Enrich before CREATE (auto‑assignment + urgency handling)
    this.before("CREATE", "Incidents", req => this.onBeforeCreate(req));

    return super.init();
  }

  /** ✅ Helper: Adjust urgency based on title (unchanged) */
  changeUrgencyDueToSubject(data) {
    if (!data) return;
    const incidents = Array.isArray(data) ? data : [data];
    incidents.forEach(incident => {
      if (incident.title?.toLowerCase().includes("urgent")) {
        incident.urgency = { code: "H", descr: "High" };
      }
    });
  }

  // ✅ Enforce admin-only operations (vertical ESC) on UPDATE / DELETE
  async onModify(req) {
    // Fetch current incident state (status + urgency)
    const result = await SELECT.one.from(req.subject)
      .columns('status_code', 'urgency_code')
      .where({ ID: req.data.ID });

    if (!result) return req.reject(404, 'Not found');

    const isAdmin = req.user?.is('admin');

    // ✅ NEW : Only admins can modify/delete an already-closed incident
    if (result.status_code === 'C') {
      if (!isAdmin) {
        const action = req.event === 'UPDATE' ? 'modify' : 'delete';
        return req.error(403, `Cannot ${action} a closed incident`);
      }
      return; // admin — allowed
    }

    // ✅ NEW :Block support from closing a high-urgency incident.
    //  Use the INCOMING urgency (user may be changing it in this same request);
    //  fall back to the current stored value if not supplied.
    const incomingStatus   = req.data.status_code;
    const effectiveUrgency = req.data.urgency_code ?? result.urgency_code;
    if (incomingStatus === 'C' && effectiveUrgency === 'H' && !isAdmin) {
      return req.error(403, 'Only administrators can close high-urgency incidents'); 
    }
  }

  // ✅ CREATE: auto-assignment + block support creating a Closed + High-urgency incident
  async onBeforeCreate(req) {
    const incident = req.data;
    const isAdmin = req.user?.is('admin');

    // Auto-assign to the creating support user
    if (incident.status_code === 'A' && req.user) {
      incident.assignedTo = req.user.id;
      console.log(`📝 Auto-assigned incident to ${req.user.id}`);
    }

    // Title-driven urgency (may set urgency to High)
    this.changeUrgencyDueToSubject(incident);

    // ✅ NEW : block support from CREATING a Closed + High-urgency incident
    const urgencyCode = incident.urgency?.code ?? incident.urgency_code;
    if (!isAdmin && incident.status_code === 'C' && urgencyCode === 'H') {
      return req.error(403, 'Only administrators can close high-urgency incidents');
    }
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
