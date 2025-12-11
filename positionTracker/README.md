# Position Tracker Subgraph Walkthrough

I have created a new subgraph in `futarchy-subgraphs/positionTracker` designed to track user balances of Futarchy Outcome Tokens.

## Architecture

### 1. Schema
The schema (`schema.graphql`) defines:
- **`Account`**: Represents a user.
- **`Token`**: Represents an outcome token (e.g., YES_COMPANY), linked to its parent Proposal.
- **`Balance`**: A link entity tracking the `amount` of a specific `Token` held by an `Account`.

```graphql
type Balance @entity {
  id: Bytes! # account + token
  account: Account!
  token: Token!
  amount: BigInt!
}
```

### 2. Data Sources
- **`FutarchyFactory`**: Listens for `NewProposal`.
- **`ERC20` (Template)**: Dynamically spawned for each of the 4 outcome tokens created by a proposal.

### 3. Logic (`src/mapping.ts`)
1.  **`handleNewProposal`**:
    - Detects a new proposal.
    - Fetches the 4 outcome token addresses (Yes/No Company, Yes/No Currency).
    - Creates `Token` entities for them.
    - Spawns the `ERC20` template to start listening to their `Transfer` events.
2.  **`handleTransfer`**:
    - Updates `Balance` entities for `from` and `to` addresses.
    - Handles Mint (from 0x0) and Burn (to 0x0) logic automatically.

## Interaction Flow (How it works)

Here is the step-by-step of how entities are generated:

### Step 1: Proposal Creation
**User Action**: Someone calls `createProposal` on the smart contract.
**Blockchain Event**: `NewProposal` is emitted.
**Subgraph Action**:
- It sees the new proposal.
- It asks: "What are the 4 tokens for this?" (e.g., `0xTokenA`, `0xTokenB`...).
- It **Creates `Token` entities** for `0xTokenA`...
- **CRITICAL**: It starts "watching" `0xTokenA` for any future transfers.

### Step 2: User Buys/Sells (The Interaction)
**User Action**: You go to the frontend and Swap (Buy "YES").
**Blockchain Event**: The swap internally triggers a `Transfer` event of `0xTokenA` from the Pool to **You**.
**Subgraph Action**:
- It catches the `Transfer(from: Pool, to: You, amount: 100)`.
- It finds or creates the **`Account` entity** for **You**.
- It finds or creates the **`Balance` entity** for **You + 0xTokenA**.
- It adds `100` to your balance.

### Step 3: Deployment
The subgraph is ready to deploy. Run this in your terminal:

```bash
cd positionTracker
npm run deploy
```
