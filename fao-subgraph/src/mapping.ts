import { Address, BigInt } from '@graphprotocol/graph-ts'
import {
  Purchase,
  Ragequit,
  SaleStarted,
  IncentiveContractSet,
  InsiderVestingContractSet,
  RagequitTokenAdded,
  RagequitTokenRemoved,
  RoleGranted,
  RoleRevoked,
  FAOSale as FAOSaleContract
} from '../generated/FAOSale/FAOSale'
import {
  Sale,
  PurchaseEvent,
  RagequitEvent,
  LifecycleEvent,
  ConfigChange,
  RagequitToken,
  RoleGrant,
  RoleRevoke
} from '../generated/schema'

const SALE_ID = 'SALE'

function getSale(): Sale {
  let sale = Sale.load(SALE_ID)
  if (sale == null) {
    sale = new Sale(SALE_ID)
  }
  return sale as Sale
}

function refreshSaleState(address: Address, sale: Sale): Sale {
  const contract = FAOSaleContract.bind(address)

  const tokenCall = contract.try_TOKEN()
  if (!tokenCall.reverted) sale.token = tokenCall.value

  const minCall = contract.try_MIN_INITIAL_PHASE_SOLD()
  if (!minCall.reverted) sale.minInitialPhaseSold = minCall.value

  const initPriceCall = contract.try_INITIAL_PRICE_WEI_PER_TOKEN()
  if (!initPriceCall.reverted) sale.initialPriceWeiPerToken = initPriceCall.value

  const longTargetCall = contract.try_LONG_TARGET_TOKENS()
  if (!longTargetCall.reverted) sale.longTargetTokens = longTargetCall.value

  const saleStartCall = contract.try_saleStart()
  if (!saleStartCall.reverted) sale.saleStart = saleStartCall.value

  const initialPhaseEndCall = contract.try_initialPhaseEnd()
  if (!initialPhaseEndCall.reverted) sale.initialPhaseEnd = initialPhaseEndCall.value

  const curPriceCall = contract.try_currentPriceWeiPerToken()
  if (!curPriceCall.reverted) sale.currentPriceWeiPerToken = curPriceCall.value

  const totalAmountRaisedCall = contract.try_totalAmountRaised()
  if (!totalAmountRaisedCall.reverted) sale.totalAmountRaised = totalAmountRaisedCall.value

  const totalCurveFundsRaisedCall = contract.try_totalCurveFundsRaised()
  if (!totalCurveFundsRaisedCall.reverted) sale.totalCurveFundsRaised = totalCurveFundsRaisedCall.value

  const totalCurveTokensSoldCall = contract.try_totalCurveTokensSold()
  if (!totalCurveTokensSoldCall.reverted) sale.totalCurveTokensSold = totalCurveTokensSoldCall.value

  const totalSaleTokensCall = contract.try_totalSaleTokens()
  if (!totalSaleTokensCall.reverted) sale.totalSaleTokens = totalSaleTokensCall.value

  const initialTokensSoldCall = contract.try_initialTokensSold()
  if (!initialTokensSoldCall.reverted) sale.initialTokensSold = initialTokensSoldCall.value

  const initialFundsRaisedCall = contract.try_initialFundsRaised()
  if (!initialFundsRaisedCall.reverted) sale.initialFundsRaised = initialFundsRaisedCall.value

  const initialNetSaleCall = contract.try_initialNetSale()
  if (!initialNetSaleCall.reverted) sale.initialNetSale = initialNetSaleCall.value

  const initialPhaseFinalizedCall = contract.try_initialPhaseFinalized()
  if (!initialPhaseFinalizedCall.reverted) sale.initialPhaseFinalized = initialPhaseFinalizedCall.value

  const longTargetReachedAtCall = contract.try_longTargetReachedAt()
  if (!longTargetReachedAtCall.reverted) sale.longTargetReachedAt = longTargetReachedAtCall.value

  return sale
}

export function handleSaleStarted(event: SaleStarted): void {
  let sale = getSale()
  sale.saleStart = event.params.startTime
  sale.initialPhaseEnd = event.params.initialPhaseEnd
  sale = refreshSaleState(event.address, sale)
  sale.save()

  let ev = new LifecycleEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  ev.startTime = event.params.startTime
  ev.initialPhaseEnd = event.params.initialPhaseEnd
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()
}

export function handlePurchase(event: Purchase): void {
  let ev = new PurchaseEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  ev.buyer = event.params.buyer
  ev.numTokens = event.params.numTokens
  ev.costWei = event.params.costWei
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()

  let sale = getSale()
  sale = refreshSaleState(event.address, sale)
  sale.save()
}

export function handleRagequit(event: Ragequit): void {
  let ev = new RagequitEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  ev.user = event.params.user
  ev.faoBurned = event.params.faoBurned
  ev.ethReturned = event.params.ethReturned
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()

  let sale = getSale()
  sale = refreshSaleState(event.address, sale)
  sale.save()
}

export function handleIncentiveSet(event: IncentiveContractSet): void {
  let ev = new ConfigChange(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  ev.kind = 'INCENTIVE'
  ev.newAddress = event.params.incentive
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()
}

export function handleInsiderSet(event: InsiderVestingContractSet): void {
  let ev = new ConfigChange(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  ev.kind = 'INSIDER'
  ev.newAddress = event.params.insider
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()
}

export function handleRagequitTokenAdded(event: RagequitTokenAdded): void {
  let token = new RagequitToken(event.params.token.toHexString())
  token.active = true
  token.lastUpdatedBlock = event.block.number
  token.lastUpdatedTx = event.transaction.hash
  token.save()
}

export function handleRagequitTokenRemoved(event: RagequitTokenRemoved): void {
  let token = RagequitToken.load(event.params.token.toHexString())
  if (token == null) {
    token = new RagequitToken(event.params.token.toHexString())
  }
  token.active = false
  token.lastUpdatedBlock = event.block.number
  token.lastUpdatedTx = event.transaction.hash
  token.save()
}

export function handleRoleGranted(event: RoleGranted): void {
  let ev = new RoleGrant(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  ev.role = event.params.role
  ev.account = event.params.account
  ev.sender = event.params.sender
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()
}

export function handleRoleRevoked(event: RoleRevoked): void {
  let ev = new RoleRevoke(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
  ev.role = event.params.role
  ev.account = event.params.account
  ev.sender = event.params.sender
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()
}
