# Checkpoint Indexer — Changelog & Status

> Last updated: 2026-02-06

---

## ✅ Fixes Applied (futarchy-complete/checkpoint)

### 1. ProposalCreatedAndAdded ABI Fix
- **Problem**: Proposals not indexing (0 locally vs 11 on CloudFront)
- **Root cause**: Event signature mismatch — was `(address,string,string)`, should be `(address,address)`
- **Files changed**:
  - `src/abis/organization.ts` — Fixed ABI inputs
  - `src/config.ts` — Fixed event signature in templates
- **Commit**: `b2dca9c`

### 2. ProposalMetadataFactory Fallback
- **Added**: `ProposalMetadataFactory` contract as direct data source in `config.ts`
- **Purpose**: Indexes `ProposalMetadataCreated(address,address)` events as fallback
- **File added**: `src/abis/proposalMetadataFactory.ts`

### 3. Troubleshooting Docs
- **Added**: Troubleshooting section to `README.md`
- **Commit**: `2dc7312`

### Verification Results (Port 3000)

| Entity | CloudFront | Localhost | Status |
|--------|------------|-----------|--------|
| Proposals | 11 | 11 | ✅ Match |
| Organizations | 7 | 7 | ✅ Match |
| MetadataEntries | 93 | 67 | ✅ Expected* |

\* CloudFront uses append-only pattern; checkpoint indexes current on-chain state only. Missing entries (`createdAt`, `logoUrl`, `currency_base_rate`, etc.) are no longer in on-chain metadata — verified via RPC.

---

## 📊 proposals-candles/checkpoint Status (Port 3001)

### Current State (Running)

| Chain | Block | Proposals | Pools | Swaps |
|-------|-------|-----------|-------|-------|
| Gnosis (100) | ~42.2M | 125 | 302 | 1000+ |
| Mainnet (1) | ~23.4M | 6 | — | — |

### ⚠️ Known Issues

#### Mainnet Indexer Stalls
- **Symptom**: Mainnet stops progressing after ~100k blocks
- **Error**: `getLogs failed: "Please, specify less number of addresses"` from PublicNode
- **Cause**: Uniswap V3 Factory emits too many events; free RPCs limit `eth_getLogs` address count
- **Workaround**: Restart container (`docker compose restart checkpoint`) — resumes from saved block
- **Proper fix needed**: Reduce getLogs block range or use paid RPC without address limits

#### Infura 402
- Key `ed94341c...` returns HTTP 402 (Payment Required) — billing limit reached

### RPC Configuration
```
GNOSIS_RPC_URL=https://rpc.gnosis.gateway.fm     # works well
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com  # works but stalls on large getLogs
```

---

## 🔲 Remaining Work

### futarchy-complete/checkpoint
- [x] Proposal indexing parity
- [x] Organization indexing parity
- [x] Metadata entries — current state verified
- [ ] Consider adding historical metadata append-only mode (low priority)

### proposals-candles/checkpoint
- [x] Gnosis indexing — working (125 proposals, 302 pools)
- [x] Mainnet indexing — partially working (6 proposals found)
- [ ] **Fix Mainnet stalling** — needs smaller getLogs block range or paid RPC
- [ ] Mainnet pool tracking — pools created but Initialize/Swap events need verification
- [ ] Full sync to chain head — Gnosis ~42M (near head), Mainnet ~23.4M (behind)
- [ ] Document proposals-candles README with same detail level as futarchy-complete
