# Frontend Integration Guide - futarchy-complete-new

> **Subgraph URL**: `https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest`  
> **Starting Block**: `44225271`  
> **Network**: Gnosis Chain

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| **Aggregator Factory** | [`0xe7C27c932C80D30c9aaA30A856c0062208d269b4`](https://gnosisscan.io/address/0xe7C27c932C80D30c9aaA30A856c0062208d269b4) |
| **Organization Factory** | [`0xCF3d0A6d7d85639fb012fA711Fef7286e6Db2808`](https://gnosisscan.io/address/0xCF3d0A6d7d85639fb012fA711Fef7286e6Db2808) |
| **Proposal Metadata Factory** | [`0x899c70C37E523C99Bd61993ca434F1c1A82c106d`](https://gnosisscan.io/address/0x899c70C37E523C99Bd61993ca434F1c1A82c106d) |

---

## Schema Overview

Three-level hierarchy:

```
Aggregator → Organization → Proposal (UnifiedOneStopShop)
```

---

## Access Control (Owner + Editor)

Each entity has a **two-tier permission system**:

| Role | Permissions |
|------|-------------|
| **Owner** | Full control: `setEditor()`, `revokeEditor()`, `transferOwnership()` + all Editor permissions |
| **Editor** | Write access: Add/Remove/Create items, Update metadata (cannot manage roles) |

### Schema Fields

```graphql
type Aggregator {
  owner: Bytes!     # Current owner address
  editor: Bytes     # Delegated editor (nullable)
  creator: Bytes!   # Original creator (immutable)
}

type Organization {
  owner: Bytes!     # Can add proposals, update metadata
  editor: Bytes     # Delegated editor (nullable)
}

type UnifiedOneStopShop {
  owner: Bytes      # Owner of metadata contract (nullable)
  editor: Bytes     # Delegated editor (nullable)
}
```

---

## Proposal Creation Paths

### Path 1: Through ProposalMetadataFactory (Direct)
```solidity
ProposalMetadataFactory.createProposalMetadata(proposalAddress, ...)
// Emits: ProposalMetadataCreated(indexed metadata, indexed proposalAddress)
```

### Path 2: Through Organization (1-tx convenience)
```solidity
Organization.createAndAddProposalMetadata(proposalAddress, ...)
// Emits: ProposalCreatedAndAdded(indexed proposalMetadata, indexed proposalAddress)
// Automatically links proposal to organization!
```

Both paths are indexed by the subgraph.

---

## GraphQL Queries

### 1. Fetch All Organizations

```graphql
query GetOrganizations {
  organizations(first: 100) {
    id
    name
    description
    metadata
    metadataURI
    owner
    editor
    createdAt
    aggregator { id name }
    proposals { id title }
  }
}
```

### 2. Fetch Proposals for an Organization

```graphql
query GetProposalsByOrg($orgId: ID!) {
  organization(id: $orgId) {
    name
    owner
    editor
    proposals {
      id
      title
      displayNameQuestion
      displayNameEvent
      description
      owner
      editor
      metadataContract
      companyToken { symbol decimals }
      currencyToken { symbol decimals }
      poolConditionalYes { id currentPrice }
      poolConditionalNo { id currentPrice }
    }
  }
}
```

### 3. Fetch Full Hierarchy

```graphql
query GetFullHierarchy {
  aggregators(first: 50) {
    id
    name
    owner
    editor
    organizations {
      id
      name
      owner
      editor
      proposals { id title owner editor }
    }
  }
}
```

### 4. Standalone Organizations (No Aggregator)

```graphql
query GetStandaloneOrgs {
  organizations(where: { aggregator: null }) {
    id
    name
    owner
    proposals { id title }
  }
}
```

---

## Permission Checking (JavaScript)

```javascript
// Check if wallet can edit (Owner OR Editor)
function canEdit(entity, wallet) {
  if (!wallet) return false;
  const w = wallet.toLowerCase();
  
  if (entity.owner?.toLowerCase() === w) return true;
  if (entity.editor?.toLowerCase() === w) return true;
  
  return false;
}

// Usage in React
function OrgCard({ org, wallet }) {
  const hasAccess = canEdit(org, wallet);
  
  return (
    <div>
      <h2>{org.name}</h2>
      {hasAccess && <button>Edit Organization</button>}
      {org.editor && <span>Editor: {org.editor}</span>}
    </div>
  );
}
```

### Full Permission Check (with Organization inheritance)

```javascript
function canEditProposal(proposal, organization, wallet) {
  const w = wallet?.toLowerCase();
  if (!w) return false;
  
  // Direct ownership/editorship of proposal
  if (proposal.owner?.toLowerCase() === w) return true;
  if (proposal.editor?.toLowerCase() === w) return true;
  
  // Ownership/editorship through organization
  if (organization?.owner?.toLowerCase() === w) return true;
  if (organization?.editor?.toLowerCase() === w) return true;
  
  return false;
}
```

---

## Fetching with JavaScript

```javascript
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest';

async function fetchOrganizations() {
  const query = `
    query {
      organizations(first: 100) {
        id
        name
        owner
        editor
        proposals { id title }
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const { data } = await response.json();
  return data.organizations;
}
```

---

## Field Types

| Field | Type | Notes |
|-------|------|-------|
| `owner` | `Bytes` | 20-byte hex address (lowercase) |
| `editor` | `Bytes` | 20-byte hex address (nullable, lowercase) |
| `creator` | `Bytes` | 20-byte hex address (lowercase) |
| `metadata` | `String` | JSON string (parse with `JSON.parse()`) |
| `metadataURI` | `String` | IPFS/HTTP URL for extended metadata |
| `createdAt` | `BigInt` | Unix timestamp (seconds) |

---

## Indexed Events

### Factory Events (Primary Indexing)
- `AggregatorMetadataCreated(indexed metadata, name)`
- `OrganizationMetadataCreated(indexed metadata, name)`
- `ProposalMetadataCreated(indexed metadata, indexed proposalAddress)`

### Template Events (Updates & Linking)
- `OrganizationAdded(indexed organizationMetadata)`
- `OrganizationCreatedAndAdded(indexed organizationMetadata, companyName)`
- `ProposalAdded(indexed proposalMetadata)`
- `ProposalCreatedAndAdded(indexed proposalMetadata, indexed proposalAddress)`
- `EditorSet(indexed newEditor)`
- `EditorRevoked(indexed oldEditor)`
- `ExtendedMetadataUpdated(metadata, metadataURI)`
