
/**
 * Formatta un numero come valuta/costo con separatore di migliaia (punto) e decimali (virgola).
 * Esempio: 1234.56 -> 1.234,56
 */
export const formatCost = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '';
  
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Gestisce il parsing dell'input stringa per il costo, convertendo la virgola in punto per il salvataggio.
 */
export const parseCostInput = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
};
