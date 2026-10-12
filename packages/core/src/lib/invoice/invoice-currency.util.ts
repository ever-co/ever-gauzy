import { CurrencyPosition } from '@gauzy/contracts';

/**
 * Renders an amount next to its currency code on the side the organization's "Currency Position"
 * setting asks for: LEFT (the default) gives "USD 100", RIGHT gives "100 USD".
 *
 * The web app already honours the setting through its `position` pipe; the generated invoice,
 * estimate and payment PDFs used to hard-code the LEFT layout (#4214).
 *
 * @param amount The amount to render, as stored on the invoice.
 * @param currency The ISO currency code of the invoice.
 * @param position The organization's `currencyPosition` setting; anything but RIGHT renders LEFT.
 */
export function formatCurrencyAmount(amount: number | string, currency: string, position?: string): string {
	return position === CurrencyPosition.RIGHT ? `${amount} ${currency}` : `${currency} ${amount}`;
}
