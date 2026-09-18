import { BadRequestException, Injectable } from '@nestjs/common';
import { ApprovalPolicyTypesStringEnum } from '@gauzy/contracts';
import { RequestApprovalService, RequestContext, isValidDecimalString } from '@gauzy/core';
import { IPurchaseApprovalRequest, IPurchaseApprovalResult } from '../purchasing.types';

/**
 * The approval capability of this package, answered by the platform's own approval machinery.
 *
 * A purchase order is a commitment, and a tenant may want the commitment to be decided by somebody
 * other than the buyer who raised it. The platform already has that decision recorded: a request is
 * a row of `request_approval`, and a threshold policy, an approver's list and the document the
 * request is about all read the same row. This class is the seam through which *this* package
 * reaches that machinery — it exists so that no other package and no other table is involved in a
 * purchase order's approval. It owns no table, writes nothing of its own, and keeps no approval
 * state that could disagree with the row the platform wrote.
 *
 * It is a facade, and deliberately a thin one. Everything the caller states is validated here, so a
 * refusal is a clear answer to a bad request rather than a constraint violation from the database;
 * everything that survives validation is handed to `RequestApprovalService`, which owns the write.
 * The purchase order is attached to the request by the polymorphic `requestId` / `requestType` pair
 * rather than by a column either side would have to own, which is what lets the approval live in the
 * kernel while the document stays in this package.
 *
 * The purchase-order service injects the `PURCHASING_APPROVAL` token rather than this class, because
 * the port is optional: an installation that approves purchase orders by role alone records the
 * approval on the order and files no request at all. An installation that wants the request row
 * binds the token to this service.
 */
@Injectable()
export class PurchaseApprovalService {
	constructor(private readonly requestApprovalService: RequestApprovalService) {}

	/**
	 * Files one approval request for a purchase order.
	 *
	 * The mapping is one field to one field, and each one is the fact the platform's approver
	 * machinery needs to act on the request:
	 *
	 * - `purchaseOrderId` becomes the request's `requestId`, and the request's type is
	 *   `PURCHASE_ORDER` — together, the polymorphic pair that says which document this decision is
	 *   about, and the only link between the request and the order.
	 * - `name` is what the requester sees in an approver's list, and it is required: a request that
	 *   does not say what it is about cannot be decided.
	 * - `amount` and `currency` are the value being committed, as an exact decimal and its ISO code,
	 *   which is what a threshold policy is applied to. Money is never parsed as a floating point
	 *   number here or anywhere below: the amount is tested as an exact decimal and written as the
	 *   text it arrived as.
	 * - `note` is carried through unchanged when the caller states one.
	 * - `organizationId` is taken from the request context and never from the caller, so a request is
	 *   always filed in the organization whose session is making the call.
	 * - `min_count` is `1`: the smallest count that makes the platform's approver machinery
	 *   applicable. A zero-count request would stand approved before anybody had looked at it, which
	 *   is the opposite of what asking for a decision means.
	 *
	 * @param request The purchase order, the value and the note to file the request with.
	 * @returns The id of the approval request row the platform wrote.
	 * @throws BadRequestException when no purchase order is named, when the request states no name or
	 * a blank one, when it states no amount or no currency, or when the amount is not an exact
	 * decimal string. Nothing is written in any of those cases.
	 */
	public async requestApproval(request: IPurchaseApprovalRequest): Promise<IPurchaseApprovalResult> {
		if (!request?.purchaseOrderId) {
			throw new BadRequestException(
				'PURCHASE_APPROVAL_ORDER_REQUIRED: an approval is requested for one named purchase order.'
			);
		}

		if (!request.name || !request.name.trim()) {
			throw new BadRequestException(
				'PURCHASE_APPROVAL_NAME_REQUIRED: an approval must say what it is about, for the approver to read.'
			);
		}

		if (!request.amount) {
			throw new BadRequestException(
				'PURCHASE_APPROVAL_AMOUNT_REQUIRED: an approval must state the value it commits, so a threshold policy can be applied to it.'
			);
		}

		if (!request.currency) {
			throw new BadRequestException(
				'PURCHASE_APPROVAL_CURRENCY_REQUIRED: an approval must state the currency its amount is in.'
			);
		}

		// The amount is tested as an exact decimal rather than converted: a value that is not one is
		// refused here, so nothing below this line has to guess at what a malformed amount meant.
		if (!isValidDecimalString(request.amount)) {
			throw new BadRequestException(
				`PURCHASE_APPROVAL_AMOUNT_NOT_DECIMAL: '${request.amount}' is not an exact decimal amount.`
			);
		}

		const saved = await this.requestApprovalService.createRequestApproval({
			name: request.name,
			requestId: request.purchaseOrderId,
			requestType: ApprovalPolicyTypesStringEnum.PURCHASE_ORDER,
			amount: request.amount,
			currency: request.currency,
			note: request.note,
			organizationId: RequestContext.currentOrganizationId(),
			min_count: 1
		});

		return { approvalId: saved.id };
	}
}
