# Troubleshooting: Reacting to Removal Events

## The Problem
**Symptom**: You call `removeProposalMetadata()` on-chain, the transaction succeeds, but the Proposal still appears in the Organization's list on the frontend.

## Root Cause
The Subgraph is an **Event Listener**. It builds its database *only* by reacting to specific events mentioned in `subgraph.yaml`.

If an event (like `ProposalRemoved`) happens on-chain but is **not** listed in the `subgraph.yaml` handlers, the Subgraph ignores it completely. It assumes the state hasn't changed.

## The Solution
We implemented a "Unlinking" pattern similar to how we handle "Linking".

### 1. Register the Event
In `subgraph.yaml`, underneath the `OrganizationTemplate` (which tracks organization contracts), we added:

```yaml
- event: ProposalRemoved(indexed address)
  handler: handleProposalRemoved
```

This tells the Graph Node: *"Whenever you see `ProposalRemoved` emitted by an Organization, run this function."*

### 2. Implement the Logic
In `src/mapping.ts`, we added `handleProposalRemoved`:

```typescript
export function handleProposalRemoved(event: ProposalRemoved): void {
    // 1. Get the Metadata Address from the event
    let metadataAddr = event.params.proposalMetadata
    
    // 2. Look up the Trading Proposal ID (because our Entities are keyed by Trading Address)
    let contract = MetadataContract.bind(metadataAddr)
    let addrCall = contract.try_proposalAddress()

    // 3. Load the Entity
    let tradingProposalId = addrCall.value.toHexString()
    let entity = UnifiedOneStopShop.load(tradingProposalId)

    // 4. THE FIX: Set the relationship to NULL
    if (entity) {
        entity.organization = null // <--- Unlinks it from the UI list
        entity.save()
    }
}
```

## Why is this "Optimal"?

### 1. Data Preservation vs. Deletion
We do **not** delete the `UnifiedOneStopShop` entity.
*   **Optimal**: The proposal still exists on-chain (as a trading market). People might still hold tokens or want to see the resolution.
*   **Result**: By setting `organization = null`, it vanishes from the "Organization Page" list but remains accessible via direct link or user portfolio.

### 2. Event-Driven Efficiency
This is O(1) complexity. We don't need to loop through arrays or poll the contract. We react instantly to the specific removal processing signal.

### 3. Handling the "Address Mismatch"
The event gives us the **Metadata Address**, but our database keys are **Trading Addresses**.
*   **Optimal**: We use a quick `try_proposalAddress()` lookup (using the `bind` helper) to bridge this gap accurately without maintaining a secondary reverse-mapping table.
