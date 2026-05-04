# TLS / HTTPS on port 443

ThreatAtlas ships an opt-in **TLS overlay** that puts a [Caddy 2](https://caddyserver.com/) reverse proxy in front of the backend and frontend. Caddy terminates HTTPS on `:443`, redirects `:80 → :443`, and forwards plain HTTP to the existing services on the internal Docker network — no changes to the application containers.

The same overlay supports three deployment modes through one environment variable, so you can use it for local dev, internal corporate-CA prod, and public Let's-Encrypt-managed prod with the same compose file.

```
                              :80   redirects to :443
   browser ─────HTTPS─────►  :443  Caddy
                                    │
                                    ├──▶ backend:8000  (/api, /scim, /health, /docs)
                                    └──▶ frontend:8080 (everything else)
```

## File layout

```
threatatlas-app/
├── caddy/
│   └── Caddyfile               ← single config, env-driven TLS directive
├── certs/                      ← drop your cert + key here (gitignored)
│   ├── cert.pem
│   └── key.pem
├── docker-compose.yml          ← base stack (HTTP only)
└── docker-compose.tls.yml      ← TLS overlay (this guide)
```

## Mode 1 — Self-signed (dev / test)

Caddy generates a local CA + server certificate on first start. Browsers will warn until you manually trust the local CA.

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Access at `https://localhost`. To get rid of browser warnings on a developer machine, copy the local CA root out of the container and trust it in your OS:

```bash
docker exec threatatlas-caddy cat /data/caddy/pki/authorities/local/root.crt > caddy_root.crt
```

Then import `caddy_root.crt` into your OS trust store (Windows: `certmgr.msc` → Trusted Root; macOS: `security add-trusted-cert`; Linux: `/usr/local/share/ca-certificates/` + `update-ca-certificates`).

## Mode 2 — Corporate CA / your own certificate (production)

This is the recommended mode for an enterprise rollout. Your security team issues a certificate from your internal CA, you drop it in `./certs/`, and Caddy uses it.

### Step 1 — Get the certificate from your corporate CA

Generate a CSR with your hostname:

```bash
openssl req -newkey rsa:2048 -nodes \
  -keyout certs/key.pem \
  -out certs/threatatlas.csr \
  -subj "/CN=threatatlas.corp.example/O=Acme Corp" \
  -addext "subjectAltName=DNS:threatatlas.corp.example"
```

Submit `threatatlas.csr` to your corporate CA (Active Directory CS, ADCS, Venafi, OpenSSL CA, SmallStep, etc.). They return a signed certificate (`.crt`, `.pem`, or `.cer`).

### Step 2 — Build `cert.pem` (leaf + chain)

Caddy expects a single PEM file with the **leaf certificate first, then any intermediates**. If your CA returned them separately, concatenate:

```bash
cat threatatlas.crt intermediate.crt root.crt > certs/cert.pem
```

If your corporate root CA is **already** in the trust store of every client (typical for AD-joined machines), you only need the leaf + intermediate(s) — root is optional. Including it doesn't hurt.

### Step 3 — Set permissions

```bash
chmod 600 certs/key.pem
chmod 644 certs/cert.pem
```

### Step 4 — Start with the mounted-cert directive

```bash
TLS_DIRECTIVE='tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem' \
THREATATLAS_HOSTNAME=threatatlas.corp.example \
  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Caddy reads the cert at startup. To rotate, drop a new pair into `./certs/` and either restart Caddy (`docker compose restart caddy`) or send `SIGUSR1` (`docker exec threatatlas-caddy caddy reload`).

### Step 5 — Verify

From any AD-joined client:

```bash
curl -v https://threatatlas.corp.example/health
# Expect: * Server certificate: subject CN=threatatlas.corp.example  (signed by your corporate CA)
# Expect: {"status":"healthy"}
```

If `curl` complains about the chain, your corporate root isn't in the system trust store for the test machine. That's a client-side issue (AD GPO usually distributes roots automatically); ThreatAtlas itself is fine.

## Mode 3 — Let's Encrypt (public-internet deployments)

Caddy can fetch and renew a Let's Encrypt certificate fully automatically over HTTP-01. Requires:

- A real public hostname pointing to the server (DNS A/AAAA record).
- Ports 80 and 443 reachable from the public internet.

```bash
TLS_DIRECTIVE='tls admin@example.com' \
THREATATLAS_HOSTNAME=threatatlas.example.com \
  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Renewal is automatic. Issued certs are persisted in the `caddy_data` volume — keep it across restarts.

## What the overlay actually changes

`docker-compose.tls.yml` adds **one new service** (`caddy`) and **overrides two values** on the existing backend:

| Override | Why |
|---|---|
| `command` adds `--proxy-headers --forwarded-allow-ips='*'` | Makes Uvicorn trust `X-Forwarded-Proto` from Caddy so `SessionMiddleware`'s secure-cookie logic works correctly. |
| `FRONTEND_URL=https://$HOSTNAME` | Invitation links and OIDC callbacks point at the HTTPS URL. |
| `CORS_ORIGINS=https://$HOSTNAME` | The frontend runs on the same origin as the backend through Caddy, so we narrow CORS to that origin. |

Backend `:8000` and frontend `:3000` remain mapped on the host (compose overlays can't easily *unmap* ports). For production, **firewall those off** so only `:443` is reachable from outside, or remove the host port mapping in your environment-specific compose file.

## Troubleshooting

**`net::ERR_CERT_AUTHORITY_INVALID` in browser**
The CA chain isn't trusted on that client. For corporate CA, fix the client's trust store (your IT distributes roots via AD/Jamf/etc). For Mode 1 self-signed, follow the trust-the-local-CA step above.

**Caddy fails with `no such file or directory: /etc/caddy/certs/cert.pem`**
Mode 2 was selected but `./certs/` is empty. Drop `cert.pem` and `key.pem` there, or fall back to `tls internal`.

**`SSL_ERROR_RX_RECORD_TOO_LONG`**
You're hitting `:443` over plain HTTP. Make sure the URL starts with `https://`.

**OIDC redirects loop or break with `state mismatch`**
The backend isn't seeing the HTTPS scheme. Confirm the overlay's backend command override applied — `docker compose exec backend ps` should show the uvicorn flags `--proxy-headers --forwarded-allow-ips='*'`.

**Want to disable redirects from `:80` (e.g. health-checker uses HTTP)**
Remove the bottom `:80 { redir … }` block from `caddy/Caddyfile` and restart the caddy container.
