export function priceComparison(shelfPrice: number, t2tPrice: number) {
  if (![shelfPrice,t2tPrice].every(Number.isFinite) || shelfPrice <= 0 || shelfPrice === t2tPrice) return {kind:'equal' as const,percentage:0};
  return {kind:shelfPrice > t2tPrice ? 'lower' as const : 'higher' as const,percentage:Math.abs(shelfPrice-t2tPrice)/shelfPrice*100};
}
