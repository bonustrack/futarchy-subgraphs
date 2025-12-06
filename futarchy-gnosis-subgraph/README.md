# Futarchy Gnosis Subgraph (futarchy-gnosis-100)

A subgraph for tracking Futarchy markets and their associated Algebra Liquidity Pools on Gnosis Chain.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Generate Code**
   Generates AssemblyScript types from the schema and ABIs.
   ```bash
   npm run codegen
   # or
   graph codegen
   ```

3. **Build**
   Compiles the subgraph.
   ```bash
   npm run build
   # or
   graph build
   ```

## Deployment

1. **Authenticate**
   Get your deploy key from [The Graph Studio](https://thegraph.com/studio/).
   ```bash
   graph auth --studio <YOUR_DEPLOY_KEY>
   ```

2. **Deploy**
   Deploys to the Studio.
   ```bash
   npm run deploy
   # or
   graph deploy --studio futarchy-gnosis-100
   ```
   > **Note**: Ensure you have created the subgraph "futarchy-gnosis-100" in The Graph Studio dashboard before deploying.
   > **Query URL**: `https://api.studio.thegraph.com/query/1718249/futarchy-gnosis-100/version/latest`

## Querying

### Filter by Date (Last 30 Days)
You can filter proposals created in the last 30 days using `createdAtTimestamp`.

```graphql
{
  proposals(
    where: { createdAtTimestamp_gt: "1764500000" } # Replace with: Current Timestamp - 2592000
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    marketName
    poolConditionalYes
    poolExpectedValueYes
    poolPredictionYes
    outcomeYesCompany
    outcomeYesCurrency
  }
}

### Get All Pools for a Proposal
Use this query in the Graph Playground to see all detected pools for a market.

```graphql
query GetProposalPools {
  proposals(first: 10, orderBy: createdAtTimestamp, orderDirection: desc) {
    marketName
    
    # Conditional Pools
    poolConditionalYes
    poolConditionalNo
    
    # Expected Value Pools (Token + Collateral)
    poolExpectedValueYes
    poolExpectedValueNo
    
    # Prediction Pools (Outcome + Collateral)
    poolPredictionYes
    poolPredictionNo
  }
}
```

### Search by Market Name
Find proposals where the market name contains specific text (e.g., "130 sDAI").

```graphql
query SearchMarket {
  proposals(
    where: { marketName_contains: "130 sDAI" }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    marketName
    # Check for specific pool types
    poolConditionalYes
    poolConditionalNo
  }   
}
```

## Structure
- `schema.graphql`: Defines `Proposal` and `TokenLookup` entities.
- `subgraph.yaml`: Manifest with `FutarchyFactory` and `AlgebraFactory` data sources.
- `src/mapping.ts`: Logic for indexing `NewProposal` events and dynamically linking `createPool` events.
