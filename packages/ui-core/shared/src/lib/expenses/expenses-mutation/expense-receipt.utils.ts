/**
 * The sample invoice image the expense form used to pre-fill as the receipt of every new expense.
 * It is not a receipt, but expenses saved before that was fixed still carry it.
 */
export const PLACEHOLDER_RECEIPT = './assets/images/others/invoice-template.png';

/** The placeholder however its path was written: `./assets/…`, `/assets/…`, `assets/…` or a full app URL. */
const PLACEHOLDER_RECEIPT_PATH = /(^|\/)assets\/images\/others\/invoice-template\.png$/;

/**
 * Whether `receipt` is the sample invoice the form used to pre-fill, rather than an uploaded receipt.
 *
 * @param receipt The receipt an expense carries.
 * @returns `true` for the legacy placeholder image.
 */
export function isPlaceholderReceipt(receipt: string | null | undefined): boolean {
	return typeof receipt === 'string' && PLACEHOLDER_RECEIPT_PATH.test(receipt.trim());
}

/**
 * The receipt an expense really has.
 *
 * @param receipt The receipt an expense carries.
 * @returns The receipt, or `null` when there is none or only the legacy placeholder.
 */
export function toActualReceipt(receipt: string | null | undefined): string | null {
	return receipt && !isPlaceholderReceipt(receipt) ? receipt : null;
}
