# futarchy-complete: Subgraph vs Checkpoint Comparison

Comparison of the original The Graph subgraph (`futarchy-complete/`) vs the Snapshot Checkpoint indexer (`futarchy-complete/checkpoint/`).

---

## TL;DR

| Aspect | The Graph Subgraph | Checkpoint Indexer |
|--------|-------------------|-------------------|
| **Purpose** | Same: Index Futarchy Registry | Same: Index Futarchy Registry |
| **Entities** | `Aggregator`, `Organization`, `ProposalEntity`, `MetadataEntry` | ✅ Same 4 entities |
| **Schema** | 77 lines with `@entity` directives | 54 lines with `Text` scalar |
| **Runtime** | WASM (AssemblyScript) | Node.js (TypeScript) |
| **Sync Speed** | ~1-5k blocks/sec | ~25k blocks/sec (**5-25x faster**) |
| **Deployment** | IPFS + Graph Node | Docker container |

> [!IMPORTANT]
> **Checkpoint is the modern replacement** — same data, faster sync, easier debugging.

---

## Architecture Comparison

### The Graph (Original)
```
┌────────────────────────────────────────────────────────┐
│                    Graph Node                          │
├────────────────────────────────────────────────────────┤
│  subgraph.yaml                                         │
│  ├── Creator (0xe7C27c93...)           Data Source     │
│  ├── OrganizationFactory (0xCF3d0A...)  Data Source    │
│  ├── ProposalMetadataFactory (0x899c...) Data Source   │
│  └── Templates:                                        │
│      ├── AggregatorTemplate                            │
│      ├── OrganizationTemplate                          │
│      └── ProposalTemplate                              │
├────────────────────────────────────────────────────────┤
│  mapping.ts (AssemblyScript → WASM)                    │
├────────────────────────────────────────────────────────┤
│  PostgreSQL (managed by Graph Node)                    │
└────────────────────────────────────────────────────────┘
```

### Checkpoint (Replacement)
```
┌────────────────────────────────────────────────────────┐
│              Docker Compose                            │
├───────────────────────┬────────────────────────────────┤
│   checkpoint          │   postgres                     │
│   (Node.js)           │   (PostgreSQL 15-alpine)       │
│   Port: 3000          │   Port: 5433                   │
├───────────────────────┴────────────────────────────────┤
│  src/config.ts                                         │
│  ├── Aggregator (0xC5eB43...)         Source           │
│  └── Templates:                                        │
│      ├── Organization (events)                         │
│      └── ProposalMetadata (events)                     │
├────────────────────────────────────────────────────────┤
│  src/writers.ts (TypeScript, native Node.js)           │
└────────────────────────────────────────────────────────┘
```

---

## Schema Comparison

### The Graph (`schema.graphql`)
```graphql
type Aggregator @entity(immutable: false) {
  id: ID!
  name: String!
  description: String!
  metadata: String
  metadataURI: String
  creator: Bytes!
  owner: Bytes!
  editor: Bytes
  createdAt: BigInt!
  organizations: [Organization!]! @derivedFrom(field: "aggregator")
  metadataProperties: [String!]
  metadataEntries: [MetadataEntry!]! @derivedFrom(field: "aggregator")
}
```

### Checkpoint (`src/schema.gql`)
```graphql
scalar Text

type Aggregator {
  id: String!
  name: String!
  description: Text!      # Text scalar for long content
  metadata: Text
  metadataURI: Text
  creator: String!
  owner: String!
  editor: String
  createdAt: Int!
}
```

### Key Schema Differences

| Feature | The Graph | Checkpoint |
|---------|-----------|------------|
| **Entity directive** | `@entity(immutable: false)` | None needed |
| **ID type** | `ID!` | `String!` |
| **Address type** | `Bytes!` | `String!` |
| **Timestamp type** | `BigInt!` | `Int!` |
| **Long text fields** | `String!` (varchar overflow risk) | `Text!` (unlimited) |
| **Derived relations** | `@derivedFrom(field: "parent")` | Parent ID stored as `String` |
| **MetadataEntry** | Full entity with relations | Same but no `@derivedFrom` |

---

## Event Handler Comparison

### The Graph (AssemblyScript)
```typescript
export function handleOrganizationAdded(event: OrganizationAdded): void {
  let org = new Organization(event.params.organizationMetadata.toHexString())
  org.name = event.params.companyName
  org.save()
}
```

### Checkpoint (TypeScript)
```typescript
export const handleOrganizationAdded: evm.Writer = async ({ event, source }) => {
  const org = new Organization(event.args.organizationMetadata.toLowerCase(), source)
  org.name = event.args.companyName
  await org.save()
}
```

### Key Handler Differences

| Aspect | The Graph | Checkpoint |
|--------|-----------|------------|
| **Syntax** | `function` | `async const` (arrow function) |
| **Event params** | `event.params.*` | `event.args.*` |
| **Entity creation** | `new Entity(id)` | `new Entity(id, source)` |
| **Save method** | `entity.save()` | `await entity.save()` |
| **Address format** | `.toHexString()` | `.toLowerCase()` |
| **Async support** | ❌ No (WASM limitation) | ✅ Yes (native Node.js) |

---

## Configuration Comparison

### The Graph (`subgraph.yaml`)
- 3 Data Sources (Creator, OrganizationFactory, ProposalMetadataFactory)
- 3 Templates (Aggregator, Organization, Proposal)
- Events declared in YAML

### Checkpoint (`src/config.ts`)
- 1 Source (Aggregator) with embedded events
- 2 Templates (Organization, ProposalMetadata)
- Events declared in TypeScript with ABIs

---

## Feature Matrix

| Feature | The Graph | Checkpoint |
|---------|-----------|------------|
| GraphQL API | ✅ Auto-generated | ✅ Auto-generated |
| Dynamic contracts (templates) | ✅ Yes | ✅ Yes |
| Block range filters | ✅ Yes | ✅ Yes |
| Hot reload | ❌ Requires redeploy | ✅ Dev mode |
| Debugging | ❌ Hard (WASM) | ✅ Easy (Node.js) |
| Self-hosted option | ⚠️ Complex (Graph Node) | ✅ Simple (Docker) |
| Hosted service | ✅ The Graph Network | ⚠️ Self-host only |

---

## Why Checkpoint?

1. **Speed**: ~25,000 blocks/sec vs ~1-5k for Graph Node
2. **Debugging**: Native TypeScript with full stack traces
3. **Simplicity**: Single Docker container setup
4. **Text handling**: `Text` scalar avoids varchar(256) overflow
5. **Async/await**: Native support for complex async operations

---

## File Structure Comparison

### The Graph
```
futarchy-complete/
├── schema.graphql          # 77 lines with @entity
├── subgraph.yaml           # 161 lines (3 sources + 3 templates)
├── src/mapping.ts          # AssemblyScript handlers
└── abis/                   # 11 ABI files
```

### Checkpoint
```
futarchy-complete/checkpoint/
├── src/schema.gql          # 54 lines with Text scalar
├── src/config.ts           # Sources + templates config
├── src/writers.ts          # TypeScript handlers
├── src/index.ts            # Express server entry
├── docker-compose.yml      # Orchestration
└── src/abis/               # 15 ABI files
```

---

## Migration Status

| Entity | Migrated to Checkpoint? |
|--------|------------------------|
| `Aggregator` | ✅ Yes |
| `Organization` | ✅ Yes |
| `ProposalEntity` | ✅ Yes |
| `MetadataEntry` | ✅ Yes |

**Checkpoint is production-ready** and running on port 3000.
