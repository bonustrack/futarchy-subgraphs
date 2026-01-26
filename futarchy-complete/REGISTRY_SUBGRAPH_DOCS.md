# Futarchy Registry Subgraph Documentation

**Subgraph:** `futarchy-complete-new`  
**Version:** `0.0.10`  
**Network:** Gnosis Chain

## Schema Overview

### Entity Hierarchy

| Entity | ID | Description |
|--------|-----|-------------|
| **Aggregator** | Contract Address | Top-level grouping (e.g., "Futarchy.fi") |
| **Organization** | Contract Address | Company/DAO under an aggregator |
| **ProposalEntity** | **Metadata Contract Address** | Proposal metadata, links to trading contract |

## Key Design Decision

> **ProposalEntity.id = Metadata Contract Address**  
> **ProposalEntity.proposalAddress = Trading Contract Address**

This keeps the metadata contract as the primary identifier (registry-centric), while `proposalAddress` points to the trading contract.

---

## Example Queries

### Get All Proposals with Hierarchy

```graphql
{
  aggregators {
    id
    name
    organizations {
      id
      name
      proposals {
        id                  # Metadata contract address
        proposalAddress     # Trading contract address
        title
        description
      }
    }
  }
}
```

### Get Proposal by Trading Contract Address

```graphql
{
  proposalEntities(where: { proposalAddress: "0x3d076d5d12341226527241f8a489d4a8863b73e5" }) {
    id
    proposalAddress
    title
    organization { id name }
  }
}
```

### Get Proposal by Metadata Contract (Direct Lookup)

```graphql
{
  proposalEntity(id: "0x3c109ec3c7eb7da835dd3b64f575efae7abfdf4e") {
    id
    proposalAddress
    title
  }
}
```

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| Aggregator Creator | `0xe7C27c932C80D30c9aaA30A856c0062208d269b4` |
| Organization Factory | `0xCF3d0A6d7d85639fb012fA711Fef7286e6Db2808` |
| Proposal Metadata Factory | `0x899c70C37E523C99Bd61993ca434F1c1A82c106d` |

---

## Frontend Integration

```javascript
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/YOUR_ID/futarchy-complete-new/version/latest";

async function getProposalByTradingContract(tradingAddress) {
  const query = `{
    proposalEntities(where: { proposalAddress: "${tradingAddress}" }) {
      id
      proposalAddress
      title
      organization { id name }
    }
  }`;
  
  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  
  return (await response.json()).data.proposalEntities[0];
}
```
