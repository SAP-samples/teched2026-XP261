/**
 * ============================================================================
 *  server.js — Custom CAP server bootstrap
 * ============================================================================
 *
 *  EXERCISE 3: Security event logging (OWASP A09 — Logging & Alerting Failures)
 *
 *  WHAT THIS FILE DOES
 *  -------------------
 *  By default, SAP CAP returns a 403 "Forbidden" when a user tries an action
 *  they are not authorized for — but it does NOT record *who* attempted *what*.
 *  That is a security blind spot: if someone probes your app, there is no trail.
 *
 *  This file hooks into the CAP server lifecycle to write a durable
 *  "SecurityEvent" entry to the SAP Audit Log Service every time a request is
 *  rejected with HTTP 403, capturing the user, the resource, and the client IP.
 *
 *  WHERE THIS FILE MUST LIVE
 *  -------------------------
 *  CAP auto-loads a custom bootstrap file only from:  srv/server.js
 *  (Anywhere else is silently ignored.)
 * ============================================================================
 */

const cds = require('@sap/cds')
const LOG = cds.log('security')   // structured logger for audit-pipeline failures

let audit

cds.on('served', async () => {
  audit = await cds.connect.to('audit-log')
})

const audit_log_403 = (resource, ip) => {
  // Guard: audit may not be initialized on the very first request
  if (!audit) {
    LOG.warn('audit-log service not ready; SecurityEvent not persisted for', resource)
    return
  }
  // own tx because the default tx may be burnt
  audit.tx(async () => {
    await audit.log('SecurityEvent', {
      data: {
        user: cds.context?.user?.id || 'unknown',
        action: `Attempt to access restricted resource "${resource}" with insufficient authority`
      },
      ip
    })
  }).catch(err => LOG.error('FAILED to persist SecurityEvent audit log', err))
}

// log for non-batch requests
cds.on('bootstrap', app => {
  app.use((req, res, next) => {
    req.on('close', () => {
      if (res.statusCode == 403) {
        const { originalUrl, ip } = req
        audit_log_403(originalUrl, ip)
      }
    })
    next()
  })
})

// log for batch subrequests — null-safe, isolated (cannot crash the process)
cds.on('serving', srv => {
  if (srv instanceof cds.ApplicationService) {
    srv.on('error', (err, req) => {
      try {
        const status = Number(err?.status || err?.code)
        if (status !== 403) return
        const http = req?.http?.req
        const originalUrl = http?.originalUrl || ''     
        if (originalUrl.endsWith('/$batch')) {
          audit_log_403(originalUrl, http?.ip)          // ✅ use originalUrl as-is
        }
      } catch (e) {
        // never let the audit path break error handling (would crash the app)
        LOG.error('audit error-handler failed', e.message)
      }
    })
  }
})

module.exports = cds.server
