 const cds = require('@sap/cds')
    const LOG = cds.log('security')   // ✅ structured logger for audit-pipeline failures
    
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
      // we need to start our own tx because the default tx may be burnt
      audit.tx(async () => {
        await audit.log('SecurityEvent', {
          data: {
            user: cds.context?.user?.id || 'unknown',   // ✅ null-safe context
            action: `Attempt to access restricted resource "${resource}" with insufficient authority`
          },
          ip
        })
      }).catch(err =>
        // ✅ never drop audit failures silently — surface via structured logger
        LOG.error('FAILED to persist SecurityEvent audit log', err)
      )
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
    
    // log for batch subrequests
    cds.on('serving', srv => {
      if (srv instanceof cds.ApplicationService) {
        srv.on('error', (err, req) => {
          if (err.code == 403) {
            const { originalUrl, ip } = req.http.req
            if (originalUrl.endsWith('/$batch')) audit_log_403(originalUrl.replace('/$batch', req.req.url), ip)
          }
        })
      }
    })
    
    module.exports = cds.server
