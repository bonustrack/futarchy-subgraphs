# Checkpoint Indexer

Futarchy Registry indexer using [Snapshot Checkpoint](https://github.com/snapshot-labs/checkpoint).

## Quick Start

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env if needed (defaults work for Gnosis Chain)
```

### 2. Start Indexer
```bash
# First run (creates tables)
RESET=true docker compose up -d

# Normal run (resumes from last block)
docker compose up -d
```

### 3. View Logs
```bash
docker compose logs -f checkpoint
```

### 4. Stop
```bash
docker compose down
```

---

## Endpoints

| Endpoint | URL |
|----------|-----|
| GraphQL | http://localhost:3000/graphql |
| Health | http://localhost:3000/health |

---

## Example Queries

### Get All Organizations
```bash
curl -s http://localhost:3000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { id name owner } }"}'
```

**Response:**
```json
{
  "data": {
    "organizations": [
      {
        "id": "0x818fdf727aa4672c80bbfd47ee13975080ac40e5",
        "name": "Gnosis",
        "owner": "0x645a3d9208523bbfee980f7269ac72c61dd3b552"
      },
      {
        "id": "0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf",
        "name": "Gnosis DAO",
        "owner": "0x645a3d9208523bbfee980f7269ac72c61dd3b552"
      },
      {
        "id": "0xe071734b1ce5332da778fb1ffd79456375d420d9",
        "name": "CoW DAO",
        "owner": "0x645a3d9208523bbfee980f7269ac72c61dd3b552"
      }
    ]
  }
}
```

### Get Proposal by Trading Address
```bash
curl -s http://localhost:3000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposalentities(where: { proposalAddress: \"0x45e1064348fd8a407d6d1f59fc64b05f633b28fc\" }) { id proposalAddress title metadata organization } }"}'
```

**Response:**
```json
{
  "data": {
    "proposalentities": [
      {
        "id": "0xa78a2d5844c653dac60da8a3f9ec958d09a4ee6a",
        "proposalAddress": "0x45e1064348fd8a407d6d1f59fc64b05f633b28fc",
        "title": "What will the impact on GNO price be",
        "metadata": "{\"chain\":100,\"closeTimestamp\":1772236800,\"twapDurationHours\":120}",
        "organization": "0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf"
      }
    ]
  }
}
```

### Get Proposals by Organization
```bash
curl -s http://localhost:3000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposalentities(where: { organization: \"0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf\" }) { id title displayNameEvent } }"}'
```

### Health Check
```bash
curl http://localhost:3000/health
# Returns: {"status":"ok","version":"1.0.0"}
```

### Full Relationship Chain (Proposal → Organization → Aggregator)
```bash
# Step 1: Get proposal by trading address
curl -s http://localhost:3000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ proposalentities(where: { proposalAddress: \"0x45e1064348fd8a407d6d1f59fc64b05f633b28fc\" }) { id proposalAddress organization } }"}'

# Step 2: Get organization with aggregator
curl -s http://localhost:3000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ organizations(where: { id: \"0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf\" }) { id name aggregator } }"}'
```

**Complete Chain:**
```
proposalAddress: 0x45e1064348fd8a407d6d1f59fc64b05f633b28fc
      ↓
proposal_metadata: 0xa78a2d5844c653dac60da8a3f9ec958d09a4ee6a
      ↓
organization: 0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf (Gnosis DAO)
      ↓
aggregator: 0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1 ✅
```

---

## Entity Schema

### Organization
| Field | Type | Description |
|-------|------|-------------|
| id | String! | Contract address |
| name | String! | Organization name |
| description | Text! | Description |
| metadata | Text | JSON metadata |
| metadataURI | Text | IPFS/URL metadata |
| owner | String! | Owner address |
| editor | String | Editor address |

### ProposalEntity
| Field | Type | Description |
|-------|------|-------------|
| id | String! | Metadata contract address |
| proposalAddress | String! | Trading contract address |
| title | Text! | Question title |
| description | Text! | Full description |
| metadata | Text | JSON metadata (chain, timestamps, etc.) |
| displayNameEvent | Text! | Event name |
| organization | String | Parent org address |

---

## Docker Commands

```bash
# Build (after code changes)
docker compose build --no-cache

# Reset database
RESET=true docker compose up -d

# View current sync block
docker compose logs checkpoint --tail 5 | grep "start:"

# Query database directly
docker compose exec postgres psql -U checkpoint -d checkpoint_futarchy -c "SELECT id, name FROM organizations;"
```

---

## Notes

- **Sync Speed:** ~25,000 blocks/second
- **GraphQL field names:** Use lowercase (e.g., `proposalentities` not `proposalEntities`)
- **Data persists:** Uses Docker volume `checkpoint_checkpoint-postgres-data`
- See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for troubleshooting
