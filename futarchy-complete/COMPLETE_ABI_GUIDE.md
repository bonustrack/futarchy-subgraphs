# Complete ABI Guide for Futarchy Metadata System

This guide explains how to interact with the Futarchy metadata hierarchy using ABIs and ethers.js/viem.

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         METADATA HIERARCHY                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│    ┌──────────────┐                                                 │
│    │  Creator     │ ─── Creates ──→ Aggregator (e.g., "Futarchy.fi")│
│    │  Factory     │                                                 │
│    └──────────────┘                                                 │
│           │                                                         │
│           ▼                                                         │
│    ┌──────────────┐                                                 │
│    │ Organization │ ─── Creates ──→ Organization (e.g., "Gnosis")  │
│    │   Factory    │                                                 │
│    └──────────────┘                                                 │
│           │                                                         │
│           ▼                                                         │
│    ┌──────────────┐                                                 │
│    │  Proposal    │ ─── Creates ──→ Proposal Metadata               │
│    │   Factory    │                  (Linked to Trading Contract)   │
│    └──────────────┘                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Contract Addresses (Gnosis Chain)

| Contract | Address | Purpose |
|----------|---------|---------|
| **Creator** (Aggregator Factory) | `0x8ffCf8546DE700FB2Ceab4709fB26ee05A19652B` | Creates Aggregator metadata |
| **OrganizationFactory** | `0x2Fa9318E1e29d7435EE9d23B687b10a9CDDD0d9e` | Creates Organization metadata |
| **ProposalMetadataFactory** | `0x8E8DBe97B2B3B6fb77F30727F3dCcA085C9755D9` | Creates Proposal metadata |
| **FutarchyFactory** | `0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345` | Creates trading proposals |
| **AlgebraFactory** | `0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766` | Creates AMM pools |

---

## 📦 Setup

```javascript
import { ethers } from 'ethers';

// Connect to Gnosis Chain
const provider = new ethers.JsonRpcProvider('https://rpc.gnosischain.com');
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Import ABIs
import CreatorABI from './abis/Creator.json';
import OrganizationFactoryABI from './abis/OrganizationFactory.json';
import ProposalMetadataFactoryABI from './abis/ProposalMetadataFactory.json';
import AggregatorABI from './abis/Aggregator.json';
import OrganizationABI from './abis/Organization.json';
import ProposalABI from './abis/Proposal.json';
```

---

## 1️⃣ Create an Aggregator

An **Aggregator** is the top-level container (e.g., "Futarchy.fi", "Metacartel").

### Factory Function

```javascript
const creator = new ethers.Contract(
  '0x8ffCf8546DE700FB2Ceab4709fB26ee05A19652B',
  CreatorABI,
  signer
);

// Create a new Aggregator
const tx = await creator.createAggregatorMetadata(
  'Futarchy.fi',                              // aggregatorName
  'Decentralized governance aggregator',      // description
  JSON.stringify({ logo: 'ipfs://Qm...' }),   // metadata (JSON string)
  'ipfs://QmABC123...'                        // metadataURI (optional IPFS link)
);

const receipt = await tx.wait();

// Get the new Aggregator address from the event
const event = receipt.logs.find(log => log.topics[0] === 
  ethers.id('AggregatorMetadataCreated(address,string)')
);
const aggregatorAddress = ethers.getAddress('0x' + event.topics[1].slice(26));
console.log('Aggregator created at:', aggregatorAddress);
```

### Read Aggregator Data

```javascript
const aggregator = new ethers.Contract(aggregatorAddress, AggregatorABI, provider);

console.log('Name:', await aggregator.aggregatorName());
console.log('Description:', await aggregator.description());
console.log('Metadata:', await aggregator.metadata());
console.log('Owner:', await aggregator.owner());
console.log('Org Count:', await aggregator.getOrganizationsCount());
```

### Update Aggregator (Owner Only)

```javascript
// Update basic info
await aggregator.connect(signer).updateAggregatorInfo(
  'New Aggregator Name',
  'Updated description with new mission'
);

// Update extended metadata (logo, social links, etc.)
await aggregator.connect(signer).updateExtendedMetadata(
  JSON.stringify({ 
    logo: 'ipfs://QmNewLogo...',
    twitter: '@futarchy_fi',
    website: 'https://futarchy.fi'
  }),
  'ipfs://QmNewMetadataURI...'
);
```

---

## 2️⃣ Create an Organization

An **Organization** belongs to an Aggregator (e.g., "Gnosis", "Kleros", "ENS").

### Factory Function

```javascript
const orgFactory = new ethers.Contract(
  '0x2Fa9318E1e29d7435EE9d23B687b10a9CDDD0d9e',
  OrganizationFactoryABI,
  signer
);

// Create a new Organization
const tx = await orgFactory.createOrganizationMetadata(
  'Gnosis',                                   // companyName
  'Gnosis DAO - Building decentralized infrastructure',  // description
  JSON.stringify({                            // metadata (JSON)
    logo: 'ipfs://QmGnosisLogo...',
    token: 'GNO',
    governanceUrl: 'https://snapshot.org/#/gnosis.eth'
  }),
  'ipfs://QmGnosisMetadata...'               // metadataURI
);

const receipt = await tx.wait();
const orgAddress = /* extract from OrganizationMetadataCreated event */;
```

### Link Organization to Aggregator

```javascript
// The Aggregator owner must call this
await aggregator.connect(signer).addOrganization(orgAddress);
```

### Read Organization Data

```javascript
const org = new ethers.Contract(orgAddress, OrganizationABI, provider);

console.log('Company Name:', await org.companyName());
console.log('Description:', await org.description());
console.log('Proposal Count:', await org.getProposalsCount());

// Get all proposals (paginated)
const proposals = await org.getProposals(0, 10); // offset, limit
console.log('Proposals:', proposals);
```

### Update Organization (Owner Only)

```javascript
// Update basic info
await org.connect(signer).updateCompanyInfo(
  'Gnosis DAO',
  'Updated description for Gnosis'
);

// Update extended metadata
await org.connect(signer).updateExtendedMetadata(
  JSON.stringify({ logo: 'ipfs://QmNewLogo...' }),
  'ipfs://QmNewURI...'
);
```

---

## 3️⃣ Create Proposal Metadata

A **Proposal** links a trading contract to human-readable metadata.

### Factory Function

```javascript
const proposalFactory = new ethers.Contract(
  '0x8E8DBe97B2B3B6fb77F30727F3dCcA085C9755D9',
  ProposalMetadataFactoryABI,
  signer
);

// Create metadata for an EXISTING trading proposal
const tradingProposalAddress = '0x...'; // From FutarchyFactory.NewProposal event

const tx = await proposalFactory.createProposalMetadata(
  tradingProposalAddress,                     // Link to trading contract
  'Will GIP-144 be approved?',               // displayNameQuestion (title)
  'GIP-144 Vote',                            // displayNameEvent (short name)
  'This proposal seeks to allocate 10000 GNO to the new ecosystem fund...', // description
  JSON.stringify({                            // metadata (JSON)
    discussionUrl: 'https://forum.gnosis.io/t/gip-144',
    snapshotUrl: 'https://snapshot.org/#/gnosis.eth/proposal/0x...',
    category: 'treasury'
  }),
  'ipfs://QmProposalDetails...'              // metadataURI
);

const receipt = await tx.wait();
const proposalMetadataAddress = /* extract from ProposalMetadataCreated event */;
```

### Link Proposal to Organization

```javascript
// The Organization owner must call this
await org.connect(signer).addProposal(proposalMetadataAddress);
```

### Read Proposal Data

```javascript
const proposal = new ethers.Contract(proposalMetadataAddress, ProposalABI, provider);

console.log('Question:', await proposal.displayNameQuestion());
console.log('Event:', await proposal.displayNameEvent());
console.log('Description:', await proposal.description());
console.log('Trading Contract:', await proposal.proposalAddress());
console.log('Metadata:', await proposal.metadata());
```

### Update Proposal (Owner Only)

```javascript
// Update display names and description
await proposal.connect(signer).updateMetadata(
  'Will GIP-144 pass the governance vote?',  // displayNameQuestion
  'GIP-144 Treasury Allocation',              // displayNameEvent
  'Updated description with more context...' // description
);

// Update extended metadata
await proposal.connect(signer).updateExtendedMetadata(
  JSON.stringify({ status: 'Active', endDate: '2024-03-15' }),
  'ipfs://QmUpdatedDetails...'
);
```

---

## 4️⃣ Read Trading Proposal Data

The **FutarchyProposal** is the actual trading contract with pools.

```javascript
import FutarchyProposalABI from './abis/FutarchyProposal.json';
import ERC20ABI from './abis/ERC20.json';

const tradingProposal = new ethers.Contract(
  tradingProposalAddress,
  FutarchyProposalABI,
  provider
);

// Get market name
console.log('Market Name:', await tradingProposal.marketName());

// Get collateral tokens
const companyToken = await tradingProposal.collateralToken1();
const currencyToken = await tradingProposal.collateralToken2();

// Get token details
const company = new ethers.Contract(companyToken, ERC20ABI, provider);
console.log('Company Token:', await company.symbol());

// Get wrapped outcomes (conditional tokens)
// Index 0: YES_COMPANY, 1: NO_COMPANY, 2: YES_CURRENCY, 3: NO_CURRENCY
const [yesCompanyAddr] = await tradingProposal.wrappedOutcome(0);
const [noCompanyAddr] = await tradingProposal.wrappedOutcome(1);
const [yesCurrencyAddr] = await tradingProposal.wrappedOutcome(2);
const [noCurrencyAddr] = await tradingProposal.wrappedOutcome(3);

console.log('YES_COMPANY token:', yesCompanyAddr);
console.log('NO_COMPANY token:', noCompanyAddr);
```

---

## 5️⃣ Complete Workflow Example

```javascript
async function setupFullHierarchy() {
  // 1. Create Aggregator
  const aggTx = await creator.createAggregatorMetadata(
    'My Futarchy Platform',
    'Decentralized decision making',
    '{}',
    ''
  );
  const aggReceipt = await aggTx.wait();
  const aggregatorAddr = extractAddress(aggReceipt, 'AggregatorMetadataCreated');
  
  // 2. Create Organization
  const orgTx = await orgFactory.createOrganizationMetadata(
    'Test DAO',
    'A test DAO for futarchy',
    '{}',
    ''
  );
  const orgReceipt = await orgTx.wait();
  const orgAddr = extractAddress(orgReceipt, 'OrganizationMetadataCreated');
  
  // 3. Link Organization to Aggregator
  const agg = new ethers.Contract(aggregatorAddr, AggregatorABI, signer);
  await agg.addOrganization(orgAddr);
  
  // 4. Create Proposal Metadata (assuming trading proposal exists)
  const proposalTx = await proposalFactory.createProposalMetadata(
    tradingProposalAddress,
    'Should we fund project X?',
    'Project X Funding',
    'Vote on funding allocation',
    '{}',
    ''
  );
  const proposalReceipt = await proposalTx.wait();
  const proposalAddr = extractAddress(proposalReceipt, 'ProposalMetadataCreated');
  
  // 5. Link Proposal to Organization
  const org = new ethers.Contract(orgAddr, OrganizationABI, signer);
  await org.addProposal(proposalAddr);
  
  console.log('✅ Hierarchy complete!');
  console.log('Aggregator:', aggregatorAddr);
  console.log('Organization:', orgAddr);
  console.log('Proposal Metadata:', proposalAddr);
}

// Helper to extract address from logs
function extractAddress(receipt, eventName) {
  const eventTopic = ethers.id(eventName + '(address,string)');
  const log = receipt.logs.find(l => l.topics[0] === eventTopic);
  return ethers.getAddress('0x' + log.topics[1].slice(26));
}
```

---

## 6️⃣ Viem Alternative

```typescript
import { createPublicClient, createWalletClient, http, getContract } from 'viem';
import { gnosis } from 'viem/chains';

const publicClient = createPublicClient({
  chain: gnosis,
  transport: http()
});

const walletClient = createWalletClient({
  chain: gnosis,
  transport: http(),
  account: privateKeyToAccount('0x...')
});

// Read from Organization
const org = getContract({
  address: '0x...',
  abi: OrganizationABI,
  publicClient
});

const name = await org.read.companyName();
const count = await org.read.getProposalsCount();

// Write (create org)
const hash = await walletClient.writeContract({
  address: '0x2Fa9318E1e29d7435EE9d23B687b10a9CDDD0d9e',
  abi: OrganizationFactoryABI,
  functionName: 'createOrganizationMetadata',
  args: ['DAO Name', 'Description', '{}', '']
});
```

---

## 7️⃣ Events Reference

| Contract | Event | Emitted When |
|----------|-------|--------------|
| Creator | `AggregatorMetadataCreated(address indexed metadata, string name)` | New aggregator created |
| OrganizationFactory | `OrganizationMetadataCreated(address indexed metadata, string name)` | New organization created |
| ProposalMetadataFactory | `ProposalMetadataCreated(address indexed metadata, address indexed proposalAddress)` | New proposal metadata created |
| Aggregator | `OrganizationAdded(address indexed organizationMetadata)` | Org linked to aggregator |
| Aggregator | `ExtendedMetadataUpdated(string metadata, string metadataURI)` | Extended metadata updated |
| Organization | `ProposalAdded(address indexed proposalMetadata)` | Proposal linked to org |
| Organization | `ExtendedMetadataUpdated(string metadata, string metadataURI)` | Extended metadata updated |
| Proposal | `MetadataUpdated(string displayNameQuestion, string displayNameEvent, string description)` | Core metadata updated |
| Proposal | `ExtendedMetadataUpdated(string metadata, string metadataURI)` | Extended metadata updated |

---

## 8️⃣ Metadata JSON Schema (Recommended)

```jsonc
// Aggregator metadata
{
  "logo": "ipfs://Qm...",
  "website": "https://...",
  "twitter": "@handle",
  "discord": "https://discord.gg/..."
}

// Organization metadata
{
  "logo": "ipfs://Qm...",
  "token": "GNO",
  "governanceUrl": "https://snapshot.org/#/...",
  "forum": "https://forum.gnosis.io",
  "chainId": 100
}

// Proposal metadata
{
  "discussionUrl": "https://forum.../topic/123",
  "snapshotUrl": "https://snapshot.org/#/.../proposal/0x...",
  "category": "treasury|protocol|grants|other",
  "startDate": "2024-01-15T00:00:00Z",
  "endDate": "2024-01-22T00:00:00Z",
  "status": "active|passed|failed|pending"
}
```

---

## 🔗 GraphQL Queries (After Indexing)

Once data is indexed by the subgraph, query it via GraphQL:

```graphql
{
  aggregators {
    id
    name
    description
    organizations {
      id
      name
      proposals {
        id
        title
        poolConditionalYes { currentPrice }
        poolConditionalNo { currentPrice }
      }
    }
  }
}
```

---

---

## 🌐 Subgraph API Endpoint

**Production URL:**
```
https://api.studio.thegraph.com/query/1719045/futarchy-aggregator/version/latest
```

### Complete GraphQL Schema

```graphql
type Aggregator @entity {
  id: ID!                    # Contract Address
  name: String!
  description: String
  creator: Bytes!
  txHash: Bytes!
  createdAt: BigInt!
  organizations: [Organization!]! @derivedFrom(field: "aggregator")
}

type Organization @entity {
  id: ID!                    # Contract Address
  aggregator: Aggregator!
  name: String!
  description: String
  owner: Bytes!
  createdAt: BigInt!
  proposals: [Proposal!]! @derivedFrom(field: "organization")
}

type Proposal @entity {
  id: ID!                    # Metadata Contract Address
  organization: Organization!
  displayNameQuestion: String
  displayNameEvent: String
  description: String
  proposalAddress: Bytes!    # The trading/logic contract address
  owner: Bytes!
  createdAt: BigInt!
}
```

### Example Queries

**Get all Aggregators with their Organizations:**
```graphql
{
  aggregators {
    id
    name
    description
    creator
    createdAt
    organizations {
      id
      name
      owner
    }
  }
}
```

**Get Organizations with their Proposals:**
```graphql
{
  organizations(first: 10) {
    id
    name
    description
    aggregator { name }
    proposals {
      id
      displayNameQuestion
      displayNameEvent
      proposalAddress
    }
  }
}
```

**Get a Specific Proposal by ID:**
```graphql
{
  proposal(id: "0x...") {
    displayNameQuestion
    displayNameEvent
    description
    proposalAddress
    organization {
      name
      aggregator { name }
    }
  }
}
```

**Search Proposals by Organization:**
```graphql
{
  proposals(where: { organization: "0x..." }) {
    id
    displayNameQuestion
    proposalAddress
    createdAt
  }
}
```

### JavaScript Fetch Example

```javascript
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1719045/futarchy-aggregator/version/latest';

async function querySubgraph(query) {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return response.json();
}

// Example: Get all aggregators
const result = await querySubgraph(`
  {
    aggregators {
      id
      name
      organizations {
        name
        proposals {
          displayNameQuestion
          proposalAddress
        }
      }
    }
  }
`);

console.log(result.data.aggregators);
```

---

## ⚠️ Important Notes

1. **Ownership**: Only the owner of each entity can update its metadata
2. **Linking**: Linking (addOrganization/addProposal) must be done by the parent entity's owner
3. **Order**: Create entities in order: Aggregator → Organization → Proposal
4. **Gas**: All create/update functions require gas (run on Gnosis Chain with xDAI)
5. **Metadata vs MetadataURI**: Use `metadata` for small JSON, `metadataURI` for IPFS links to larger data
