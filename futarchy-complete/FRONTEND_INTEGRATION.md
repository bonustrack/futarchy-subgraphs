# Frontend Integration Guide - futarchy-complete-new

> **Subgraph URL**: `https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest`  
> **Starting Block**: `44225271`  
> **Network**: Gnosis Chain

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| **Aggregator Factory** | [`0xB6DCc90C13414488557205Af65fe7bf59862a5D5`](https://gnosisscan.io/address/0xB6DCc90C13414488557205Af65fe7bf59862a5D5) |
| **Organization Factory** | [`0xD573Db1606b4D385E498dB65B584a4bdF2B61F86`](https://gnosisscan.io/address/0xD573Db1606b4D385E498dB65B584a4bdF2B61F86) |
| **Proposal Metadata Factory** | [`0x19A4780243F0d72A8d6EF788652c19AC199B3BFd`](https://gnosisscan.io/address/0x19A4780243F0d72A8d6EF788652c19AC199B3BFd) |

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
