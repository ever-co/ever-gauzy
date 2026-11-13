import { BadRequestException } from '@nestjs/common';
import { InvoiceStatusTypesEnum } from '@gauzy/contracts';

/** The refusal of a change that would take a void invoice or estimate out of VOID. */
export const INVOICE_VOID_IS_FINAL =
	'INVOICE_VOID_IS_FINAL: a void invoice or estimate keeps its status. Create a new invoice instead.';

/**
 * Whether a change states a status other than VOID: the only change a void invoice refuses. A change that states no
 * status leaves the status as it is.
 *
 * @param status The status the change states.
 */
export function statesStatusOtherThanVoid(status: string | null | undefined): boolean {
	const statesStatus = status !== undefined && status !== null;
	return statesStatus && status !== InvoiceStatusTypesEnum.VOID;
}

/**
 * Refuses a change that takes a void invoice or estimate to another status. Voiding releases the time its lines
 * billed, which another invoice may then bill while nothing records that the time moved: a void invoice made live
 * again could charge that time twice. Its correction is a new invoice.
 *
 * @param storedStatus The status the invoice has.
 * @param statedStatus The status the change states.
 * @throws BadRequestException when the invoice is void and the change states another status.
 */
export function assertVoidStaysVoid(storedStatus: string | undefined, statedStatus: string | null | undefined): void {
	const isVoid = storedStatus === InvoiceStatusTypesEnum.VOID;
	const reopensVoid = isVoid && statesStatusOtherThanVoid(statedStatus);
	if (reopensVoid) {
		throw new BadRequestException(INVOICE_VOID_IS_FINAL);
	}
}
