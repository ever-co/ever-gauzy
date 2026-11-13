import { BadRequestException } from '@nestjs/common';
import { EstimateStatusTypesEnum, InvoiceStatusTypesEnum } from '@gauzy/contracts';

/** The refusal of a change that would take a void invoice or estimate out of VOID. */
export const INVOICE_VOID_IS_FINAL =
	'INVOICE_VOID_IS_FINAL: a void invoice or estimate keeps its status. Create a new invoice instead.';

/** The refusal of a change that would take a rejected estimate to a status other than REJECTED or VOID. */
export const INVOICE_REJECTED_IS_FINAL =
	'INVOICE_REJECTED_IS_FINAL: a rejected estimate keeps its status. Create a new estimate instead.';

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
 * Refuses a change that takes a document out of a final status. Voiding an invoice or estimate, or rejecting an
 * estimate, releases the time its lines billed, which another invoice may then bill while nothing records that the
 * time moved: the document made live again could charge that time twice. A void document keeps VOID; a rejected
 * estimate keeps REJECTED or is voided. Its correction is a new invoice or estimate.
 *
 * @param storedStatus The status the document has.
 * @param statedStatus The status the change states.
 * @throws BadRequestException when the document is void and the change states another status, or is a rejected
 * estimate and the change states a status other than REJECTED or VOID.
 */
export function assertFinalStatusKept(storedStatus: string | undefined, statedStatus: string | null | undefined): void {
	if (!statesStatusOtherThanVoid(statedStatus)) {
		return;
	}
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
