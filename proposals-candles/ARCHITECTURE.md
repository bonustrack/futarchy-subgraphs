# Proposals Candles Architecture

How the subgraph selectively indexes **only Futarchy proposal pools** (not all DEX pools).

---

## Core Concept: Token Whitelisting Filter

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. FutarchyFactory                    2. DEX Factory                       │
│  ┌──────────────────┐                  ┌──────────────────┐                 │
│  │   NewProposal    │                  │  Pool/PoolCreated│                 │
│  │      Event       │                  │      Event       │                 │
│  └────────┬─────────┘                  └────────┬─────────┘                 │
│           │                                     │                           │
│           ▼                                     ▼                           │
│  ┌──────────────────┐                  ┌──────────────────┐                 │
│  │ handleNewProposal│                  │ handlePoolCreated│                 │
│  └────────┬─────────┘                  └────────┬─────────┘                 │
│           │                                     │                           │
│           ▼                                     ▼                           │
│  ┌──────────────────┐                  ┌──────────────────┐                 │
│  │ WhitelistedToken │◄─────────────────│ Token0/Token1    │                 │
│  │    Entities      │   LOOKUP         │   in Whitelist?  │                 │
│  └──────────────────┘                  └────────┬─────────┘                 │
│                                                 │                           │
│                                        ┌────────┴────────┐                  │
│                                        │                 │                  │
│                                    YES ▼              NO ▼                  │
│                              ┌─────────────┐    ┌─────────────┐             │
│                              │ CREATE Pool │    │   IGNORE    │             │
│                              │ + Template  │    │   (skip)    │             │
│                              └──────┬──────┘    └─────────────┘             │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                                │
│                              │  Index Pool │                                │
│                              │   Events    │                                │
│                              │ (Swap/Mint) │                                │
│                              └──────┬──────┘                                │
│                                     │                                       │
│                                     ▼                                       │
│                              ┌─────────────┐                                │
│                              │   Candles   │                                │
│                              │   Swaps     │                                │
│                              └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### 1. FutarchyFactory → Whitelist Tokens

When `NewProposal` is emitted:

```typescript
handleNewProposal(event):
  1. Bind to FutarchyProposal contract
  2. Read collateralToken1 → save as "COMPANY" 
  3. Read collateralToken2 → save as "COLLATERAL" (quote token)
  4. Read wrappedOutcome(0-3) → save with roles:
     - [0] YES_COMPANY
     - [1] NO_COMPANY  
     - [2] YES_CURRENCY
     - [3] NO_CURRENCY
  5. Create Proposal entity linking all tokens
```

**Result**: 6 tokens whitelisted per proposal.

---

### 2. DEX Factory → Selective Pool Indexing

When `Pool`/`PoolCreated` is emitted:

```typescript
handlePoolCreated(event):
  1. Load token0 from WhitelistedToken
  2. Load token1 from WhitelistedToken
  
  // THE FILTER ⬇️
  if (!token0 || !token1) {
    log.warning("Ignoring Pool: tokens not whitelisted")
    return  // ← SKIP non-Futarchy pools
  }
  
  3. Create Pool entity
  4. Classify pool type based on token roles
  5. Create dynamic template to index pool events
```

**Key Filter Logic**:
```typescript
// BOTH tokens must be in the whitelist
if (!token0 || !token1) return  // Ignore pool
```

---

### 3. Pool Events → Candles & Swaps

Once a pool is indexed via template:

| Event | Handler | Result |
|-------|---------|--------|
| `Initialize` | `handleInitialize` | Sets initial price |
| `Swap` | `handleSwap` | Creates Swap entity + updates Candles |
| `Mint` | `handleMint` | Updates pool liquidity |
| `Burn` | `handleBurn` | Updates pool liquidity |

---

## Pool Classification

Based on token roles, pools are classified:

| Token0 Role | Token1 Role | Pool Type |
|-------------|-------------|-----------|
| YES/NO_COMPANY | COLLATERAL | `EXPECTED_VALUE` |
| YES/NO_CURRENCY | COLLATERAL | `PREDICTION` |
| YES/NO_COMPANY | YES/NO_CURRENCY | `CONDITIONAL` |

---

## Candle Generation

Every swap updates OHLCV candles for 6 time periods:

```typescript
CANDLE_PERIODS = [60, 300, 900, 3600, 14400, 86400]
//               1m   5m   15m   1hr   4hr   1day
```

Candle ID format: `{poolId}-{period}-{periodStartUnix}`

---

## Why This Design?

| Without Filter | With Filter |
|----------------|-------------|
| Index ALL pools on chain | Index ONLY proposal pools |
| Millions of pools | ~6 pools per proposal |
| Massive storage/compute | Lean & focused |
| Irrelevant data | Only Futarchy markets |

The whitelist acts as a **permission gate** — pools can only be indexed if their tokens came from a Futarchy proposal.
