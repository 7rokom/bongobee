/**
 * Calculate markup based on mohasagor reselling_price
 */
export function getResellerMarkup(resellingPrice: number): number {
  if (resellingPrice <= 100) return 5;
  if (resellingPrice <= 300) return 15;
  if (resellingPrice <= 600) return 40;
  if (resellingPrice <= 1000) return 70;
  if (resellingPrice <= 1500) return 100;
  if (resellingPrice <= 3000) return 150;
  return 200;
}

export function getMarkedUpResellerPrice(resellingPrice: number): number {
  return resellingPrice + getResellerMarkup(resellingPrice);
}
