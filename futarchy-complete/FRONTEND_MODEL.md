# Frontend Integration Guide

This is how the frontend "thinks" about the data.

## 1. The React Component (Page)

Use standard hooks to fetch. The key is that **no math is needed** on the client.

```tsx
// MarketPage.tsx
import { useQuery } from '@apollo/client';
import { GET_MARKET_PAGE } from './queries';

export default function MarketPage({ proposalId }) {
  const { data, loading } = useQuery(GET_MARKET_PAGE, { variables: { proposalId }});

  if (loading) return <Skeleton />;
  
  const market = data.unifiedOneStopShop;

  return (
    <div className="layout">
      {/* HEADER */}
      <MarketHeader 
        title={market.title} 
        tokens={market.companyToken} // Pass symbol/decimals down
      />

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-3 gap-4">
        
        {/* COLUMN 1: CONDITIONAL (The Main Event) */}
        <PoolCard 
          label="Pass Market"
          pool={market.poolConditionalYes} 
          symbolBase={market.companyToken.symbol} 
          symbolQuote={market.currencyToken.symbol}
        />
        <PoolCard 
          label="Fail Market"
          pool={market.poolConditionalNo}
          symbolBase={market.companyToken.symbol}
          symbolQuote={market.currencyToken.symbol}
        />

        {/* COLUMN 2: EXPECTED VALUE (The "Real" Value) */}
        <PoolCard
          label="Value if Pass"
          pool={market.poolExpectedYes}
          symbolBase={market.companyToken.symbol}
          symbolQuote="USDC"
        />
        <PoolCard
          label="Value if Fail"
          pool={market.poolExpectedNo}
          symbolBase={market.companyToken.symbol}
          symbolQuote="USDC"
        />

        {/* COLUMN 3: PREDICTION (Probabilities) */}
        <PoolCard
          label="Probability Pass"
          pool={market.poolPredictionYes}
          isPercentage={true} // Special flag to render 0.40 as 40%
        />
        <PoolCard
          label="Probability Fail"
          pool={market.poolPredictionNo}
          isPercentage={true}
        />
      </div>
    </div>
  );
}
```

## 2. The Generic "Pool Card"

Since every pool in the response has the **exact same shape** (thanks to the Fragment), you write ONE component for all 6 charts.

```tsx
// PoolCard.tsx
export function PoolCard({ label, pool, symbolBase, symbolQuote, isPercentage }) {
  const priceDisplay = isPercentage 
    ? (pool.currentPrice * 100).toFixed(1) + "%"
    : pool.currentPrice + " " + symbolQuote;

  return (
    <Card>
      <h3>{label}</h3>
      <div className="big-price">{priceDisplay}</div>
      
      {/* THE CHART: Just pass the data straight in */}
      <CandleChart 
        data={pool.candles} 
        height={200}
      />
      
      {/* THE TAPE */}
      <RecentTrades list={pool.trades} />
    </Card>
  );
}
```

## 3. The Data Shape (JSON Response)

This is exactly what the frontend receives. Note how clean it is.

```json
{
  "data": {
    "unifiedOneStopShop": {
      "title": "Will GIP-144 be approved?",
      "companyToken": { "symbol": "GNO" },
      "currencyToken": { "symbol": "USDC" },
      
      "poolConditionalYes": {
        "currentPrice": "250.50", // 1 YES_GNO = 250.50 YES_USDC
        "candles": [
          { "time": 1700001000, "open": "249.00", "close": "250.50" }
        ],
        "trades": [
           { "type": "BUY", "amountBase": "100", "price": "250.50" }
        ]
      },
      
      "poolPredictionYes": {
         "currentPrice": "0.65", // 65% Probability
         "candles": [...]
      }
      // ... same for other 4 pools
    }
  }
}
```
