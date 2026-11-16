# Felmee Admin production deployment

**Goal:** Publish the current admin on 64.188.118.144 with production API access and automatically renewed HTTPS.

**Architecture:** Build static Vite assets with an empty VITE_API_BASE_URL. Serve them with the existing nginx on port 8443; proxy /api/ and /ws to https://felmee.com. Reuse the valid IP certificate and its existing six-hour renewal timer, which reloads nginx after renewal.

**Constraints:** Keep LimiLink on ports 80/443, preserve its ACME webroot, do not restart the host or backend, do not upload source credentials, and do not send banking mutations during verification.

**Ruling:** Use port 8443 because the requested IP already serves another working application on 443. A dedicated port preserves the existing service without changing frontend routes or requiring new DNS records.

## Tasks

- [x] Inspect SSH access, nginx sites, existing services, production API and certificate renewal.
- [x] Build the current frontend with same-origin API URLs.
- [x] Upload a versioned static release and add deploy/nginx.conf as a separate nginx site.
- [x] Test nginx configuration and reload it; verify API and WebSocket proxying.
- [x] Test certificate renewal with the existing ACME client and check the enabled timer.
- [x] Verify the public HTTPS page, deep routes, assets and browser rendering; record deployment and rollback instructions.

## Verification

Build succeeded. Uploaded archive SHA-256: `72be2bc7679653f7cc16fc3ad21cea7e992684820474ca2a54e730d4529548af`.
nginx configuration validation passed. Public HTTPS and static assets returned 200; protected API returned the upstream 401 JSON envelope. Chrome trusted the certificate and rendered login from the /documents deep link at 1440px and 390px without runtime exceptions. A real browser WebSocket opened over wss://64.188.118.144:8443/ws. Certbot renewal dry-run succeeded; its six-hour timer is enabled and active. Existing LimiLink remained available on 443.

Ruling: nginx reload is asynchronous; the first immediate local health check ran before the new listener opened. That attempt automatically rolled back. The deployment check now retries refused connections, and the subsequent publication passed.

Deployment and rollback paths are recorded in `docs/deployment.md`. No backend restart, production database write, SMS request or banking mutation was performed.

Final review found no material issues. Safe OPTIONS requests with the actual admin Origin returned 200 and the correct Access-Control-Allow-Origin for login POST and application PATCH. All login image assets loaded successfully in Chrome.
