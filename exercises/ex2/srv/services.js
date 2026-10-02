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
  // Fetch current incident state (status + urgency)
  const id = req.data?.ID ?? req.params?.[0]?.ID;

  if (!id) return req.reject(400, 'Missing incident ID');

  const result = await SELECT.one.from(req.subject)
    .columns('status_code', 'urgency_code')
    .where({ ID: id });

  if (!result) return req.reject(404, `Incident ${id} not found`);

  // ✅ NEW: Allow only admins to modify/delete/activate closed incidents
  if (result.status_code === 'C') {
    if (!req.user || !req.user.is('admin')) {
      const action = req.event === 'UPDATE'        ? 'modify'
                   : req.event === 'draftActivate' ? 'activate a draft of'
                   : 'delete';
      return req.error(403, `Cannot ${action} a closed incident`);
    }
    return; // admin — allowed to proceed
  }

  // ✅ UPDATE: Check if user is attempting to close the incident
  // For draftActivate, read status from draft data (req.data.status_code)
  const incomingStatus = req.data?.status_code;
  if (incomingStatus === 'C') {
    // ✅ NEW: Block support users from closing high-urgency incidents
    if (result.urgency_code === 'H' && (!req.user || !req.user.is('admin'))) {
      return req.error(403, 'Only administrators can close high-urgency incidents');
    }
  }

  // ✅ Additional business rules (if any) can go here
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
    // ✅ SECURE: Parameterized query using CAP’s fluent API
    this.on('fetchCustomer', async (req) => {
      const { customerID } = req.data;
      
    // ✅ Use parameterized query — input is automatically sanitized
    const query = SELECT.from('Customers') // Use the CDS entity name, not the full path
          .where({ ID: customerID });      
      const results = await cds.run(query);
      return results;
    });

    return super.init();
  }
}

module.exports = { ProcessorService, AdminService }
