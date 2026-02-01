# 🛡️ Null Safety in Subgraph Mappings

This document explains null safety patterns in the `futarchy-complete` subgraph mappings and documents the critical fix deployed in v0.0.15 (v3).

---

## The Problem: v2 Crash at Block 44,463,012

### What Happened

A CoW DAO organization was created with `null` metadata. The subgraph crashed when trying to process it:

```
Mapping aborted at src/mapping.ts, line 177, column 45,
with message: unexpected null in handler `handleOrganizationCreatedAndAdded`
```

### Transaction Details

- **TX**: `0x44fecb7bc03d767cab0cf78a0c4cab7ea8a5c26be372d31740f9ed675aa79721`
- **Block**: 44,463,012 (Gnosis Chain)
- **Method**: `createAndAddOrganizationMetadata("CoW DAO", ...)`

---

## Root Cause Analysis

### The Dangerous Pattern

```typescript
// Step 1: Contract call succeeds but returns null
let mCall = contract.try_metadata()
entity.metadata = mCall.reverted ? "" : mCall.value
//                                      ↑ mCall.value can be null!

// Step 2: The crash happens here
entity.metadataProperties = extractKeys(entity.metadata as string)
//                                                      ↑ CRASH!
// AssemblyScript cannot cast null to string
```

### Why `mCall.reverted ? "" : mCall.value` Is Not Enough

| Scenario | `mCall.reverted` | `mCall.value` | Result |
|----------|------------------|---------------|--------|
| Call fails (reverts) | `true` | undefined | `""` ✅ |
| Call succeeds with data | `false` | `"{...}"` | `"{...}"` ✅ |
| Call succeeds with null | `false` | `null` | `null` ❌ |

The third case is what broke v2.

---

## The Fix (v0.0.15 / v3)

### Pattern: Null Check Before Type Cast

```typescript
// BEFORE (crashes on null):
entity.metadataProperties = extractKeys(entity.metadata as string)

// AFTER (null-safe):
entity.metadataProperties = extractKeys(
  entity.metadata !== null ? changetype<string>(entity.metadata) : ""
)
```

### All Fixed Locations (8 instances)

| Handler | Line | Entity Type |
|---------|------|-------------|
| `handleAggregatorCreated` | 50 | Aggregator |
| `handleOrganizationMetadataCreated` | 77 | Organization |
| `handleProposalMetadataCreated` | 118 | Proposal |
| `handleOrganizationCreatedAndAdded` | 177 | Organization |
| `handleAggregatorExtendedMetadataUpdated` | 196 | Aggregator |
| `handleProposalCreatedAndAdded` | 268 | Proposal |
| `handleOrganizationExtendedMetadataUpdated` | 293 | Organization |
| `handleProposalExtendedMetadataUpdated` | 343 | Proposal |

---

## Null Safety By Field

### ✅ Already Safe Fields

| Field | Pattern | Why Safe |
|-------|---------|----------|
| `name` | `event.params.name` | Event params are never null |
| `displayNameQuestion` | `if (!qCall.reverted) { ... }` | Only assigned if call succeeds |
| `displayNameEvent` | `if (!eCall.reverted) { ... }` | Only assigned if call succeeds |
| `owner` | `oCall.reverted ? fallback : oCall.value` | Schema allows null |
| `editor` | `eCall.reverted ? null : eCall.value` | Schema allows null |

### ⚠️ Fields That Can Store Null (But Don't Crash)

| Field | Pattern | Impact |
|-------|---------|--------|
| `description` | `dCall.reverted ? "" : dCall.value` | Stores null, no crash |
| `metadataURI` | `uCall.reverted ? "" : uCall.value` | Stores null, no crash |
| `metadata` | `mCall.reverted ? "" : mCall.value` | Stores null, **was crashing** in `extractKeys` |

### ✅ Helper Functions Are Defensive

```typescript
// extractKeys handles empty strings
function extractKeys(metadata: string): string[] {
  if (metadata.length == 0) return []  // ← Early return
  ...
}

// updateMetadataEntries handles null
function updateMetadataEntries(parentId: string, parentType: string, metadata: string | null): void {
  if (metadata === null) return  // ← Null check
  if (metadata.length == 0) return
  ...
}
```

---

## AssemblyScript-Specific Notes

### `as string` vs `changetype<string>`

In AssemblyScript (used by The Graph):

```typescript
// This CRASHES if value is null:
let str = nullableValue as string

// This works (explicit type cast):
let str = nullableValue !== null ? changetype<string>(nullableValue) : ""
```

### Why IDE Shows Errors

The IDE's TypeScript checker doesn't know about `changetype` because it's an AssemblyScript built-in. The errors are false positives:

```
Cannot find name 'changetype'. (severity: error)
```

**These can be ignored** - the Graph Protocol compiler handles it correctly.

---

## Testing for Null Safety

### Before Deploying

1. Build the subgraph to check for compile errors:
   ```bash
   npm run build
   ```

2. Test with known edge cases (organizations/proposals with null/empty metadata)

### After Deploying

1. Check indexing status:
   ```bash
   curl -s "http://34.195.104.118:8030/graphql" \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ indexingStatuses { subgraph health fatalError { message } } }"}'
   ```

2. Verify the subgraph passes the problematic block:
   ```bash
   # Block 44,463,012 is where CoW DAO was created
   # v3 should index past this without errors
   ```

---

## Future Prevention

### Guidelines for New Handlers

1. **Always use `try_` methods** for contract calls
2. **Check for null** before type casting or string operations
3. **Use defensive patterns** in helper functions
4. **Test with edge cases** (null, empty string, malformed JSON)

### Recommended Pattern

```typescript
let mCall = contract.try_metadata()
// Store the value (null is OK for storage)
entity.metadata = mCall.reverted ? "" : mCall.value

// But when USING it, always check for null:
if (entity.metadata !== null) {
  entity.metadataProperties = extractKeys(changetype<string>(entity.metadata))
} else {
  entity.metadataProperties = []
}
```

---

## Version History

| Version | IPFS Hash | Status | Notes |
|---------|-----------|--------|-------|
| v1 | `QmWi2sSCu...` | ✅ Healthy | Original, predates CoW DAO |
| v2 | `QmbrVKA27...` | ❌ Failed | Crashed at block 44,463,012 |
| v3 | `QmTvu7WaF...` | ✅ Healthy | Null safety fix applied |

---

## Related Links

- [HEALTH_CHECK.md](../../HEALTH_CHECK.md) - Endpoint documentation and troubleshooting
- [The Graph Docs: AssemblyScript](https://thegraph.com/docs/en/developing/assemblyscript-api/)
