import { PermissionsEnum } from '@gauzy/contracts';

/**
 * The permission pair this module owns, declared where the resource lives.
 *
 * The pair is asymmetric for a reason specific to settlement. Reading a term is an ordinary read — an
 * accountant needs the term list, a dunning report prints the term a document was settled against —
 * while **editing one changes the due dates derived for every document not yet settled**, across
 * buyers and vendors alike. A term is not a field on a document; it is the agreement the document's
 * dates come out of, which is why it is its own pair rather than part of an invoice edit.
 *
 * The values are members of the platform catalogue, not strings contributed at bootstrap: the kernel
 * owns them.
 */
export const PAYMENT_TERM_PERMISSIONS = {
	/** Read settlement terms and their instalments, and preview a schedule for an amount. */
	PAYMENT_TERMS_VIEW: PermissionsEnum.PAYMENT_TERMS_VIEW,
	/** Create, change and delete settlement terms and their instalments. */
	PAYMENT_TERMS_EDIT: PermissionsEnum.PAYMENT_TERMS_EDIT
} as const;
