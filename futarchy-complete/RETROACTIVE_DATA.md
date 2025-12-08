# Handling Retroactive Data

You asked:
> "what im worirred is that for exmaple the trades tha ppen long time before the proposalmetadata comapy emtada evne eist"

## The Solution: "Adoption"

This is how we solve it in the Subgraph architecture:

1.  **Always Index Pools**: We listen to `PoolCreated` events from the `AlgebraFactory` from block 0.
    *   So, every Swap, Mint, and Burn is **already indexed** and stored in the `Pool` entity, even if we don't know what "Proposal" it belongs to yet.
    *   At this stage, the Subgraph knows "Pool 0x123 exists and has 500 swaps", but it doesn't know it's "Proposal 5's YES Pool".

2.  **The Metadata Event**: Later, the `Aggregator` (or Creator) emits an event: "Proposal 5 uses Company Token X and Currency Y".
    *   Our mapping catches this.
    *   It calculates/finds the addresses of the pools (e.g., it calculates that Pool 0x123 corresponds to the YES outcome).

3.  **The Link**: The mapping then sets `proposal.poolConditionalYes = "0x123"`.

4.  **The Query**: When you run the `GetMarketPageData` query:
    *   It looks up Proposal 5.
    *   It sees `poolConditionalYes` is `0x123`.
    *   It looks up Pool `0x123`.
    *   It grabs the **existing** 500 swaps from that pool.

**Result**: You instantly get the entire history of the pool, even the trades that happened before the Metadata event. The history is attached to the *Pool*, not the *Metadata*.
