# Subgraph Missing Proposals: Diagnosis and Fix

## 1. The Core Issue: Race Condition

The problem was a **race condition** between the creation of a Proposal and the indexing of its parent Organization.

### The Events Timeline
In block `4351719x`, the following happened in rapid succession:

1.  **Event A**: `ProposalAdded` (A new proposal contract is deployed and an event is emitted).
2.  **Event B**: `OrganizationAdded` (The Organization itself is registered/added to the Aggregator).

### The Subgraph's Perspective
-   The subgraph listens for `OrganizationAdded`. When it sees this, it starts a new **Template** (`OrganizationTemplate`) to listen to that specific Organization's events.
-   **The Problem**: By the time `OrganizationAdded` happened (Event B), `ProposalAdded` (Event A) had *already happened*.
-   Since the `OrganizationTemplate` wasn't "active" yet when Event A occurred, it completely missed the proposal.

---

## 2. Technical Deep Dive: Why `Proposal` ABI?

### The Error
We encountered this build error:
`Could not find ABI for contract "Proposal", try adding it to the 'abis' section...`

### The Explanation
You asked: **"Why was Proposal ABI necessary?"**

In our fix (the backfill logic), we are inside the `handleOrganizationAdded` function.
1.  This function runs under the context of the **`AggregatorTemplate`** (because `AggregatorTemplate` listens for `OrganizationAdded`).
2.  Inside this function, we get a list of proposal addresses: `[0x123..., 0x456...]`.
3.  To index them, we need to read their data (Question, Description, etc.).
4.  This data lives on the **Proposal Contract**, NOT the Organization contract.
5.  Therefore, we must "bind" to the Proposal Contract: `ProposalContract.bind(proposalAddress)`.

**Why the error?**
The Graph's architecture requires that any ABI you want to use inside a mapping (like `AggregatorTemplate`'s mapping) **must be explicitly listed** in that Template's `abis` section in `subgraph.yaml`.
-   We didn't need `ProposalCreator` because we weren't interacting with the Creator.
-   We needed `Proposal` because we were essentially "becoming" a Proposal reader for a brief moment to backfill the data.

---

## 3. The Backend Logic: `createProposalHelper`

We created a helper function to standardize how we index a proposal, whether it comes from a live event or our backfill loop.

```typescript
function createProposalHelper(
    proposalAddress: Bytes,     // The address of the proposal contract
    organizationAddress: Bytes, // Who owns it
    timestamp: BigInt,          // When it happened
    txFrom: Bytes               // Who triggered it
): void {
    // 1. Prepare dynamic indexing for the future
    // We tell the subgraph: "Start using ProposalTemplate to listen to this address permanently"
    ProposalTemplate.create(Address.fromBytes(proposalAddress)) 

    // 2. Load or Create the Entity
    let id = proposalAddress.toHexString()
    let entity = Proposal.load(id)
    if (entity == null) {
        entity = new Proposal(id)
        entity.createdAt = timestamp
    }
    
    // 3. Bind to the Smart Contract to fetch data
    // This is where we use the Proposal ABI!
    let contract = ProposalContract.bind(Address.fromBytes(proposalAddress))

    // 4. Safe fetching with try_ calls (prevents crashing if a call fails)
    let qCall = contract.try_displayNameQuestion()
    entity.displayNameQuestion = qCall.reverted ? "" : qCall.value

    let descCall = contract.try_description()
    entity.description = descCall.reverted ? "" : descCall.value

    entity.save()
}
```

---

## 4. Troubleshooting Walkthrough (Step-by-Step)

Here is how we diagnosed and fixed the issue:

### Step 1: Identify the Discrepancy
-   **Symptom**: Frontend shows "No proposals". Block explorer shows events exist.
-   **Action**: Checked `subgraph.yaml`. Saw `startBlock` was `43517000`.
-   **Hypothesis 1**: Maybe we started too late?
-   **Test**: Moved `startBlock` back to `43513671`. **Result**: Still missing.

### Step 2: Analyze Event Ordering
-   **Observation**: We looked at the exact block numbers on Gnosis Scan.
    -   Proposal Created: Block ...193
    -   Organization Added: Block ...198
-   **Realization**: The Proposal existed *before* the Subgraph started watching the Organization. This is a classic "Dynamic Data Source Race Condition".

### Step 3: Implement Backfill (The Fix)
-   **Goal**: When we *do* see the Organization (Block 198), we must check if we missed anything.
-   **Code Change**: In `handleOrganizationAdded`:
    1.  Call `Organization.getProposalsCount()` -> Returns `1`.
    2.  Call `Organization.getProposals()` -> Returns `[0xProposalAddress]`.
    3.  Loop through list and call `createProposalHelper(0xProposalAddress)`.

### Step 4: Fix Build Errors
-   **Error**: `Proposal ABI missing`.
-   **Fix**: Added `- name: Proposal, file: ./abis/Proposal.json` to `AggregatorTemplate` in `subgraph.yaml`.
-   **Error**: `AssemblyScript compiler crash`.
-   **Fix**: Fixed type casting. Used `Address.fromBytes(addr)` instead of unsafe casting.

### Step 5: Verify
-   **Action**: Deployed v0.0.7.
-   **Result**: Ran `verify_query.js`. The proposal `0xa62c...` appeared!
-   **Frontend**: Updated `index.html` to v0.0.7. Frontend now shows the data.

---

## 5. The "Chain of Knowledge": How the Subgraph Knows What to Look For

The subgraph relies on **ABI (Application Binary Interface)** files to understand the blockchain events. Each level of the hierarchy "knows" about the events required to trigger the next level.

This map is defined in `subgraph.yaml` and connects to the files in the `abis/` folder:

1.  **Level 1: The Creator** (`abis/Creator.json`)
    -   **Knows About**: `AggregatorMetadataCreated` event.
    -   **Role**: Listens to the specific Factory address. When checking `AggregatorMetadataCreated`, it extracts the new **Aggregator Address** and starts an `AggregatorTemplate`.

2.  **Level 2: The Aggregator** (`abis/Aggregator.json`)
    -   **Knows About**: `OrganizationAdded` event.
    -   **Role**: Listens to the Aggregator contract. When it sees `OrganizationAdded`, it extracts the new **Organization Address** and starts an `OrganizationTemplate`.

3.  **Level 3: The Organization** (`abis/Organization.json`)
    -   **Knows About**: `ProposalAdded` event.
    -   **Role**: Listens to the Organization contract. When it sees `ProposalAdded`, it extracts the new **Proposal Metadata Address**.
    -   **Happy Path**: It immediately starts a `ProposalTemplate` for that new address.
    -   **Race Condition Fix**: It *also* asks the contract "Did I miss any proposals?" using the `getProposals()` function (which is also defined in this ABI logic).

4.  **Level 4: The Proposal** (`abis/Proposal.json`)
    -   **Knows About**: The data fields (`displayNameQuestion`, `description`) and updates (`MetadataUpdated`).
    -   **Role**: Used by the subgraph to actually read the human-readable content from the Proposal contract and store it in the database.

By having these 4 JSON files in the project, the subgraph has a complete map of the entire Futarchy system's event structure.
