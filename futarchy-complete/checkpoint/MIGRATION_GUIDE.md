# Checkpoint Migration Guide

Migration from The Graph (futarchy-complete) to Snapshot Checkpoint for Futarchy Registry indexing.

## Overview

| Aspect | The Graph | Checkpoint |
|--------|-----------|------------|
| **Runtime** | WASM (AssemblyScript) | Node.js (TypeScript) |
| **Database** | PostgreSQL (managed) | PostgreSQL (self-hosted) |
| **Deployment** | IPFS + Graph Node | Docker container |
| **Language** | AssemblyScript | TypeScript |
| **Entity Creation** | `Entity.save()` | `new Model(id, indexer).save()` |

## Quick Start

```bash
cd futarchy-subgraphs/checkpoint

# First run (creates tables)
RESET=true docker compose up -d

# Normal run (resumes from last block)
docker compose up -d

# View logs
docker compose logs -f checkpoint

# Stop
docker compose down
```

## Endpoints

| Endpoint | URL |
|----------|-----|
| GraphQL | http://localhost:3000/graphql |
| Health | http://localhost:3000/health |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Docker Compose                   │
├─────────────────────┬───────────────────────────┤
│   checkpoint        │   postgres                │
│   (Node.js)         │   (PostgreSQL 15)         │
│   Port: 3000        │   Port: 5433              │
├─────────────────────┴───────────────────────────┤
│            checkpoint_checkpoint-net             │
└─────────────────────────────────────────────────┘
```

---

## Key Differences from The Graph

### 1. Schema Definition

**The Graph** uses `@entity` directive:
```graphql
type Organization @entity {
  id: ID!
  name: String!
}
```

**Checkpoint** uses plain GraphQL:
```graphql
type Organization {
  id: String!
  name: String!
}
```

### 2. Data Writers (Event Handlers)

**The Graph** (AssemblyScript):
```typescript
export function handleOrganizationAdded(event: OrganizationAdded): void {
  let org = new Organization(event.params.organizationMetadata.toHexString());
  org.name = event.params.companyName;
  org.save();
}
```

**Checkpoint** (TypeScript):
```typescript
import { Organization } from '../.checkpoint/models';

export const handleOrganizationAdded: evm.Writer = async ({ event, blockNumber }) => {
  const org = new Organization(event.args.organizationMetadata.toLowerCase(), 'gnosis');
  org.name = event.args.companyName;
  await org.save();
};
```

### 3. Model Generation

Checkpoint requires running model generation before build:
```bash
npx checkpoint generate
```

This creates `.checkpoint/models.ts` from `src/schema.gql`.

---

## File Structure

```
checkpoint/
├── docker-compose.yml     # Docker orchestration
├── Dockerfile             # Container build
├── init.sql               # PostgreSQL extensions
├── package.json           # Dependencies + overrides
├── tsconfig.json          # TypeScript config
├── src/
│   ├── index.ts           # Entrypoint + Express server
│   ├── config.ts          # Contract addresses, events, templates
│   ├── schema.gql         # Entity definitions
│   └── writers.ts         # Event handlers
└── .checkpoint/
    └── models.ts          # Generated ORM models (auto-generated)
```

---

## Configuration

### `src/config.ts`
```typescript
export const config: CheckpointConfig = {
  network_node_url: process.env.RPC_URL,
  sources: [
    {
      contract: '0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1', // Aggregator
      start: 38000000,
      events: [
        { name: 'OrganizationAdded(address)', fn: 'handleOrganizationAdded' },
        // ...
      ]
    }
  ],
  templates: {
    Organization: {
      abi: OrgAbi,
      events: [
        { name: 'ProposalAdded(address)', fn: 'handleProposalAdded' },
        // ...
      ]
    }
  }
};
```

### Environment Variables

```env
DATABASE_URL=postgres://checkpoint:checkpoint123@postgres:5432/checkpoint_futarchy
RPC_URL=https://rpc.gnosischain.com
RESET=false
```

---

## Docker Setup

### `docker-compose.yml`
```yaml
services:
  checkpoint:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://checkpoint:checkpoint123@postgres:5432/checkpoint_futarchy
      RPC_URL: https://rpc.gnosischain.com
      RESET: ${RESET:-false}
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: checkpoint
      POSTGRES_PASSWORD: checkpoint123
      POSTGRES_DB: checkpoint_futarchy
    volumes:
      - checkpoint-postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U checkpoint -d checkpoint_futarchy"]

volumes:
  checkpoint-postgres-data:
```

### `Dockerfile`
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx checkpoint generate  # Generate ORM models
RUN npm run build || true
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

---

## Persistence

### Data Persistence
- PostgreSQL data stored in Docker volume: `checkpoint_checkpoint-postgres-data`
- Data survives container restarts
- To reset: `RESET=true docker compose up -d`

### Sync State
- Checkpoint tracks last synced block in `_checkpoints` table
- On restart (without RESET), resumes from last block
- Sync speed: ~25,000 blocks/second

---

## Troubleshooting

### 1. Duplicate GraphQL Module Error
```
Error: Cannot use GraphQLObjectType "Organization" from another module
```
**Fix:** Add to `package.json`:
```json
{
  "dependencies": {
    "graphql": "^16.8.1"
  },
  "overrides": {
    "graphql": "$graphql"
  }
}
```

### 2. Models Not Found
```
Cannot find module '../.checkpoint/models'
```
**Fix:** Add `checkpoint generate` to Dockerfile and update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "rootDir": "."
  },
  "include": ["src/**/*", ".checkpoint/**/*"]
}
```

### 3. Block Not Found Error
```
BlockNotFoundError: Block at number "44495350" could not be found
```
**Cause:** Checkpoint caught up to chain head, RPC doesn't have latest block yet.
**Status:** Normal at chain head - Checkpoint retries automatically.

### 4. PostgreSQL Connection Refused
```
ECONNREFUSED 127.0.0.1:5432
```
**Fix:** Use Docker network hostname (`postgres`) not `localhost` in DATABASE_URL.

### 5. pgcrypto Extension Missing
```
function gen_random_uuid() does not exist
```
**Fix:** Add `init.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 6. Value Too Long for varchar(256)
```
error: value too long for type character varying(256)
```
**Cause:** Checkpoint maps GraphQL `String` to PostgreSQL `varchar(256)`. Fields like metadata, description, or title often exceed this limit.

**Fix:** Use the `Text` scalar type for long content fields in `src/schema.gql`:
```graphql
scalar Text

type Organization {
  id: String!
  name: String!
  description: Text!    # Use Text instead of String
  metadata: Text        # Use Text instead of String
  metadataURI: Text     # Use Text instead of String
  owner: String!
}
```

**Important:** After changing schema, you must:
1. Rebuild Docker image: `docker compose build --no-cache`
2. Reset database (schema change): `RESET=true docker compose up -d`

---

## Comparison: Graph-Node vs Checkpoint

| Feature | Graph-Node | Checkpoint |
|---------|------------|------------|
| Setup complexity | Higher (IPFS, Graph Node) | Lower (single container) |
| Memory usage | Higher | Lower |
| Sync speed | Fast | Very fast (~25k blocks/s) |
| Language | AssemblyScript | TypeScript |
| Debugging | Harder (WASM) | Easier (Node.js) |
| Database | Managed | Self-hosted |
| GraphQL | Auto-generated | Auto-generated |
| Dynamic contracts | Templates | Templates |

---

## Commands Reference

```bash
# Build
docker compose build --no-cache

# Start with reset
RESET=true docker compose up -d

# Start without reset (resume)
docker compose up -d

# View logs
docker compose logs -f checkpoint

# Stop
docker compose down

# Query data
curl http://localhost:3000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { id name } }"}'
```
