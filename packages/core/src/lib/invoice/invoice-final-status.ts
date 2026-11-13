import { BadRequestException } from '@nestjs/common';
import { EstimateStatusTypesEnum, ID, InvoiceStatusTypesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ILinesTransaction, lockInvoice } from '../invoice-item/invoice-item-billed-time';

/** The refusal of a change that would take out of VOID a document whose released time another one bills since. */
export const INVOICE_VOID_IS_FINAL =
	'INVOICE_VOID_IS_FINAL: another invoice bills the time this void invoice or estimate released, so it keeps its ' +
	'status. Create a new invoice instead.';

/**
 * The refusal of a change that would take to a status other than REJECTED or VOID a rejected estimate whose released
 * time another document bills since.
 */
export const INVOICE_REJECTED_IS_FINAL =
	'INVOICE_REJECTED_IS_FINAL: another invoice bills the time this rejected estimate released, so it keeps its ' +
	'status. Create a new estimate instead.';

/** A stored document, as far as its final status goes: its status, and whether its released time was billed since. */
export interface IFinalStatusState {
	status?: string;
	releasedTimeBilledAt?: Date | null;
}

/**
 * Whether a change states a status other than VOID: the only change a final status refuses, since a void document
 * stays void and a rejected estimate may still be voided. A change that states no status leaves the status as it is.
 *
 * @param status The status the change states.
 */
export function statesStatusOtherThanVoid(status: string | null | undefined): boolean {
	const statesStatus = status !== undefined && status !== null;
	return statesStatus && status !== InvoiceStatusTypesEnum.VOID;
}

/**
 * Refuses a change that takes a document out of a final status once another document bills the time it released.
 * Voiding an invoice or estimate, or rejecting an estimate, releases the time its lines billed; when another document's
 * line bills that time, the billing records it on the released document (`releasedTimeBilledAt`), and the document
 * made live again would charge that time twice. Such a void document keeps VOID; such a rejected estimate keeps
 * REJECTED or is voided. Its correction is a new invoice or estimate. A document whose released time no other line
 * bills changes status as it always could.
 *
 * @param stored The document as stored: its status and whether its released time was billed since.
 * @param statedStatus The status the change states.
 * @throws BadRequestException when the released time of the document is billed since, and the document is void and
 * the change states another status, or is a rejected estimate and the change states a status other than REJECTED or
 * VOID.
 */
export function assertFinalStatusKept(
	stored: IFinalStatusState | null | undefined,
	statedStatus: string | null | undefined
): void {
	if (!statesStatusOtherThanVoid(statedStatus)) {
		return;
	}
	const isReleasedTimeBilled = Boolean(stored?.releasedTimeBilledAt);
	if (!isReleasedTimeBilled) {
		return;
	}
	const storedStatus = stored.status;
	if (storedStatus === InvoiceStatusTypesEnum.VOID) {
		throw new BadRequestException(INVOICE_VOID_IS_FINAL);
	}
	const isRejected = storedStatus === EstimateStatusTypesEnum.REJECTED;
	const staysRejected = statedStatus === EstimateStatusTypesEnum.REJECTED;
	const leavesRejected = isRejected && !staysRejected;
	if (leavesRejected) {
		throw new BadRequestException(INVOICE_REJECTED_IS_FINAL);
	}
}

/** A change to an invoice, as far as a final status goes: the invoice it names and the status it states. */
export interface IInvoiceStatusChange {
	id?: ID;
	status?: string;
}

/**
 * Refuses a change as {@link assertFinalStatusKept} does, against the status read with the invoice locked (see
 * `lockInvoice`): a void or a rejection another request is writing is waited for and seen, so it cannot come between
 * the check and the write the transaction runs next.
 *
 * @param transaction The transaction the write runs in.
 * @param change The change.
 * @throws BadRequestException when the change states a status the invoice's final status refuses.
 */
export async function holdFinalStatus(transaction: ILinesTransaction, change: IInvoiceStatusChange): Promise<void> {
	const tenantId = RequestContext.currentTenantId();
	const stored = await lockInvoice(transaction, change.id, tenantId);
	assertFinalStatusKept(stored, change.status);
}
