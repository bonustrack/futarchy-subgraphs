# Nested Filtering in Checkpoint — Analysis & Fix

## Problem

The futarchy registry schema uses **flat `String` references** between entities:

```graphql
# Current schema (futarchy-complete/checkpoint/src/schema.gql)
type ProposalEntity {
  organization: String    # ← flat string, just stores "0x3fd2..."
}

type Organization {
  aggregator: String      # ← flat string, just stores "0xc5eb..."
}
```

This means we **cannot** filter proposals by their organization's aggregator in a single query. We need 3 sequential queries to answer "give me proposals belonging to our aggregator":

```
Step 1: organizations(where: { aggregator: "0xc5eb..." })  →  get org IDs
Step 2: proposalentities(where: { proposalAddress: "0x45e..." })  →  get org field
Step 3: Client-side check: is org in trusted list?
```

This is a security concern — contracts are permissionless, anyone can create proposals. We must verify the full trust chain (proposal → org → aggregator) before displaying data.

---

## Discovery: Checkpoint Already Supports Nested Filtering

The Checkpoint source code ([resolvers.ts](file:///home/ubuntu/futarchy-subgraphs/checkpoint-source/src/graphql/resolvers.ts#L167-L216)) already handles `_` suffix nested where clauses:

```typescript
// resolvers.ts line 167-216
} else if (typeof w[1] === 'object' && w[0].endsWith('_')) {
    const fieldName = w[0].slice(0, -1);
    const nestedReturnType = getNonNullType(
      returnType.getFields()[fieldName].type
    );
    const nestedTableName = getTableName(nestedReturnType.name.toLowerCase());

    // Performs an INNER JOIN to the nested entity table
    query = query
      .columns(nestedEntitiesMappings[fieldName])
      .innerJoin(nestedTableName, `${tableName}.${fieldName}`, '=', `${nestedTableName}.id`);

    // Applies the where filter on the joined table
    handleWhere(query, nestedTableName, w[1]);
}
```

And [controller.ts](file:///home/ubuntu/futarchy-subgraphs/checkpoint-source/src/graphql/controller.ts#L379-L397) auto-generates the `_` filter inputs when a field is typed as a `GraphQLObjectType`:

```typescript
// controller.ts line 379-394
if (nonNullFieldType instanceof GraphQLObjectType) {
    if (!prefix) {
      whereInputConfig.fields[`${field.name}_`] = getWhereType(
        nonNullFieldType,
        nestedType.name
      ).where;
    }
}
```

**But this only activates when the schema field is an entity type, not `String`.**

---

## Solution: Change Schema to Use Entity References

```diff
# src/schema.gql

 type Organization {
   id: String!
-  aggregator: String
+  aggregator: Aggregator
   name: String!
   ...
 }

 type ProposalEntity {
   id: String!
-  organization: String
+  organization: Organization
   proposalAddress: String!
   ...
 }

 type MetadataEntry {
   id: String!
   key: String!
   value: Text!
-  aggregator: String
-  organization: String
-  proposal: String
+  aggregator: Aggregator
+  organization: Organization
+  proposal: ProposalEntity
 }
```

This would enable **single-query trust-chain verification**:

```graphql
# Filter proposals by aggregator in ONE query
{
  proposalentities(
    where: {
      proposalAddress: "0x45e1064348fd8a407d6d1f59fc64b05f633b28fc"
      organization_: { aggregator: "0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1" }
    }
  ) {
    id
    title
    organization { name aggregator { name } }
  }
}
```

If the proposal doesn't belong to our aggregator → empty result. No client-side validation needed.

---

## What Needs to Change in the Indexer

The handler code in [writers.ts](file:///home/ubuntu/futarchy-subgraphs/futarchy-complete/checkpoint/src) currently stores organization/aggregator as plain address strings:

```typescript
proposal.organization = orgAddress;  // stores "0x3fd2..."
```

With entity references, it still stores the **same string** (the entity ID). The database column remains a `string(256)` — see [controller.ts L573-L587](file:///home/ubuntu/futarchy-subgraphs/checkpoint-source/src/graphql/controller.ts#L573-L587). Checkpoint resolves the reference at query time via inner join.

**So the handler code doesn't need to change** — only the schema types.

---

## Summary

| Aspect | Current (flat) | After fix (entity refs) |
|--------|---------------|------------------------|
| Schema field type | `String` | `Organization` / `Aggregator` |
| Database storage | Same string | Same string (no change) |
| Handler code | No change needed | No change needed |
| Nested `where_:` filtering | ❌ Not available | ✅ Supported |
| Inline resolution | ❌ Requires extra query | ✅ Auto-resolved via join |
| Queries to verify trust chain | 3 sequential | 1 |
