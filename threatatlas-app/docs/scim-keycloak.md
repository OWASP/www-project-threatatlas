# SCIM sync: Keycloak → ThreatAtlas

ThreatAtlas exposes a SCIM 2.0 server at `/scim/v2` so an IdP can provision
Users and Groups automatically. Keycloak does not ship with a SCIM outbound
client by default — you enable it with the community extension
[scim-for-keycloak](https://github.com/Captain-P-Goldfish/scim-for-keycloak).

This guide covers the local-dev setup.

## 0. Start the dev stack with Keycloak

The Keycloak service lives in `docker-compose.dev.yml` (overlay) so the base
`docker-compose.yml` stays production-clean. From `threatatlas-app/`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This boots Postgres, backend, frontend, **and** Keycloak 25 with the
`threatatlas` realm auto-imported (client `threatatlas`,
secret `threatatlas-dev-secret`, users `alice@threatatlas.dev` /
`bob@threatatlas.dev` — password `test123`).

## 1. Generate a SCIM bearer token

1. Sign in to ThreatAtlas as an admin.
2. Go to **User Management → SCIM Tokens → New Token**.
3. Give it a label (`Keycloak SCIM`) and copy the plaintext token — it is shown
   exactly once.

The SCIM endpoint is:

```
http://<threatatlas-backend-host>:8000/scim/v2
```

From inside the `threatatlas-keycloak` container on the compose network, use
the service name: `http://backend:8000/scim/v2`.

## 2. Install the scim-for-keycloak extension

The Keycloak container in this repo uses the vanilla `quay.io/keycloak/keycloak:25.0`
image. To enable outbound SCIM, either:

### Option A — Build a custom image

Create `keycloak/Dockerfile`:

```dockerfile
FROM quay.io/keycloak/keycloak:25.0 AS builder
ENV KC_DB=postgres
ADD --chown=keycloak:keycloak \
    https://github.com/Captain-P-Goldfish/scim-for-keycloak/releases/download/<latest>/scim-for-keycloak-kc-25-<latest>.jar \
    /opt/keycloak/providers/
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:25.0
COPY --from=builder /opt/keycloak/ /opt/keycloak/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
```

Update `docker-compose.yml`:

```yaml
keycloak:
  build:
    context: ./keycloak
    dockerfile: Dockerfile
  # ...rest stays the same
```

### Option B — Drop the JAR into a volume

Easier for experimentation:

```yaml
keycloak:
  # ...
  volumes:
    - ./keycloak:/opt/keycloak/data/import:ro
    - ./keycloak/providers:/opt/keycloak/providers
  command: ["start-dev", "--import-realm"]
```

Put the JAR in `./keycloak/providers/scim-for-keycloak-kc-25-<version>.jar`.

## 3. Configure the SCIM client in Keycloak

After the extension is installed, the Keycloak admin console exposes a **SCIM**
tab under the realm menu.

1. Sign in at [http://localhost:8080/admin](http://localhost:8080/admin)
   as `admin / admin` and select the `threatatlas` realm.
2. Go to **SCIM → Service Provider Configuration**.
3. Create a new remote SCIM provider with:
   - **Name**: `ThreatAtlas`
   - **Base URL**: `http://backend:8000/scim/v2`
   - **Authentication type**: `Bearer Token`
   - **Bearer token**: paste the plaintext token from step 1
   - **Sync mode**: `Real-time` (recommended) or `Scheduled`
4. Under **Resource Mappings**, enable both `User` and `Group` resources.
5. Trigger an initial full sync.

## 4. Map Keycloak roles to ThreatAtlas group roles

ThreatAtlas groups created via SCIM are initialised with `role=read_only` —
SCIM doesn't carry a notion of "role" in its core schema, so the extension
only pushes the `displayName` and membership.

After first sync, an admin needs to:

1. Go to **User Management → Groups** in ThreatAtlas.
2. Edit each synced group (identified by the `SCIM` badge) and set the
   appropriate role.
3. From that point on, users provisioned into the group inherit the role via
   `effective_role` automatically; no further manual intervention required.

This means your provisioning flow is:

```
AD Group → Keycloak Group → SCIM push → ThreatAtlas Group (role set by admin once)
  ↓                                                            ↓
AD User  → Keycloak User  → SCIM push → ThreatAtlas User → effective role
```

## 5. Testing without installing the extension

You can validate the SCIM server end-to-end with `curl`, simulating what the
extension would send. Example flow:

```bash
TOKEN="<your SCIM bearer token>"
BASE="http://localhost:8000/scim/v2"

# Create a user (as if Keycloak pushed it)
curl -X POST "$BASE/Users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName":"carol@corp.example",
    "externalId":"kc-user-abc",
    "emails":[{"value":"carol@corp.example","primary":true}],
    "name":{"givenName":"Carol","familyName":"Example"},
    "active":true
  }'

# Create a group and put her in it
curl -X POST "$BASE/Groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas":["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "displayName":"Threat Modelers",
    "externalId":"kc-group-xyz",
    "members":[{"value":"<new user id>"}]
  }'

# PATCH (add/remove members) — what most IdPs send for membership changes
curl -X PATCH "$BASE/Groups/<group id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    "Operations":[
      {"op":"add","path":"members","value":[{"value":"<user id>"}]},
      {"op":"remove","path":"members[value eq \"<other user id>\"]"}
    ]
  }'
```

## Security notes

- The SCIM bearer token grants full Users/Groups CRUD. Store it only in the IdP.
- Revoke immediately if leaked — **User Management → SCIM Tokens → Revoke**.
- Token hash (SHA-256 of plaintext) is all that's stored. Plaintext is
  shown once at creation.
- SCIM requests never flow through the browser; the token should never leave
  your IdP's backend.

## Works with other IdPs

The server is SCIM 2.0 compliant; the same endpoint works with:

- **Okta** — built-in SCIM provisioning app (free tier supported).
- **Microsoft Entra ID** — "Enterprise application" → "Provisioning" → SCIM.
- **OneLogin**, **JumpCloud**, **Authentik** — all push standard SCIM 2.0.
