const cds = require('@sap/cds');

class ProcessorService extends cds.ApplicationService {
init() {
    // ✅ Guard UPDATE, DELETE and draft activation — prevents support users from modifying,
    // deleting, or activating drafts of closed or high-urgency incidents
    this.before(['UPDATE', 'DELETE', 'draftActivate'], 'Incidents', req => this.onModify(req));

    // ✅ Retain horizontal ESC fixes (auto-assignment, urgency handling)
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

// ✅ NEW: Enforce admin-only operations (vertical ESC)
async onModify(req) {
    const id = req.data?.ID ?? req.params?.[0]?.ID;
    if (!id) return req.reject(400, 'Missing incident ID');

    // ✅ select assignedTo, used if Support user activates draft of another user's incident 
    const result = await SELECT.one.from(req.subject)
      .columns('status_code', 'urgency_code', 'assignedTo')
      .where({ ID: id });
    if (!result) return req.reject(404, `Incident ${id} not found`);

    const isAdmin = req.user?.is('admin');

    // ✅ NEW: Ownership enforcement — covers UPDATE, DELETE *and* draftActivate
    //    Mirrors the @restrict where-clause: 'assignedTo is null or assignedTo = $user'
    if (!isAdmin && result.assignedTo && result.assignedTo !== req.user.id) {
      return req.error(403, 'You can only modify or save incidents assigned to you');
    }

    // --- existing closed-status rule ---
    if (result.status_code === 'C') {
      if (!isAdmin) {
        const action = req.event === 'UPDATE'        ? 'modify'
                     : req.event === 'draftActivate' ? 'activate a draft of'
                     : 'delete';
        return req.error(403, `Cannot ${action} a closed incident`);
      }
      return;
    }

    // --- existing high-urgency close rule ---
    if (req.data?.status_code === 'C' && result.urgency_code === 'H' && !isAdmin) {
      return req.error(403, 'Only administrators can close high-urgency incidents');
    }
}
  // ✅ Retain auto-assignment logic (unchanged)
  async onBeforeCreate(req) {
    const incident = req.data;
    if (incident.status_code === 'A' && req.user) {
      incident.assignedTo = req.user.id;
      console.log(`📝 Auto-assigned incident to ${req.user.id}`);
    }
    this.changeUrgencyDueToSubject(incident);
  }
}
class AdminService extends cds.ApplicationService {
  init() {
    this.on('fetchCustomer', async (req) => {
      const { customerID } = req.data;

      console.log('✅ Using SECURE parameterized query method.');

      try {
        // ✅ SECURE: Parameterized query using CAP's fluent API
        // User input is bound as a parameter, never interpolated into SQL structure
        const query = SELECT.from('Customers').where({ ID: customerID });

        console.log('✅ Secure parameterized query constructed (input treated as literal parameter)');

        const results = await cds.run(query);
        console.log('✅ Results count:', results.length);
        return results;
      } catch (error) {
        console.error('❌ Error:', error.message);
        cds.log('security').error(`SQL error: ${error.message.substring(0, 100)}`);
        return req.error(400, 'Invalid customer identifier');
      }
    });

    return super.init();
  }
}
module.exports = { ProcessorService, AdminService }
