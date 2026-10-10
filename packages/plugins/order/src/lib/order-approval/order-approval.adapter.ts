import { BadRequestException, Injectable } from '@nestjs/common';
import {
	ApprovalPolicyTypesStringEnum,
	DecimalString,
	ID,
	IRequestApproval,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import {
	RequestApprovalService,
	RequestContext,
	STORAGE_SCALE,
	formatDecimalUnits,
	isValidDecimalString,
	normalizeDecimalString,
	toUnitsAtScale
} from '@gauzy/core';
import { IOrderApprovalPort, IOrderApprovalRequest } from '../order.types';

/**
 * The approval capability of the order package, answered by the platform's own approval machinery.
 *
 * A B2B buyer may place an order that a staff member has to approve before it is confirmed. The platform
 * already records such a decision: a request is a row of `request_approval`, and a threshold policy, an
 * approver's list and the document the request is about all read the same row. This class is the seam
 * through which the order package reaches it — exactly as the purchasing package's approval facade does
 * for a purchase order. It owns no table and keeps no approval state of its own.
 *
 * The order is attached to the request by the polymorphic `requestId` / `requestType` pair, with the type
 * `SALES_ORDER`, rather than by a column on either side. The domain service injects the `ORDER_APPROVAL`
 * token, never this class; `OrderPlatformAdaptersModule` provides it, and the installation binds the token
 * to it (`apps/api/src/plugin-composition.ts`).
 */
@Injectable()
export class OrderApprovalAdapter implements IOrderApprovalPort {
	constructor(private readonly requestApprovalService: RequestApprovalService) {}

	/**
	 * Files one approval request for an order.
	 *
	 * - `orderId` becomes the request's `requestId`, with the type `SALES_ORDER` — the polymorphic pair that
	 *   says which document the decision is about.
	 * - `name` is what the approver's list shows, and it is required.
	 * - `amount` and `currency` are the value being committed, which a threshold policy is applied to. The
	 *   amount is normalised as an exact decimal at the column's own scale — the order's total arrives as the
	 *   number its column's transformer parsed — and a digit below that scale is refused rather than rounded.
	 * - the organization is the order's, falling back to the session's.
	 * - `min_count` is 1: the smallest count that makes the approver machinery applicable. A zero-count
	 *   request would stand approved before anybody had looked at it.
	 *
	 * @param request The order, its value and the buyer's note.
	 * @returns The approval request row that was written.
	 * @throws BadRequestException when no order or name is stated, or the amount is not an exact decimal.
	 */
	public async requestApproval(request: IOrderApprovalRequest): Promise<{ approvalId: ID }> {
		if (!request?.orderId) {
			throw new BadRequestException(
				'ORDER_APPROVAL_ORDER_REQUIRED: an approval is requested for one named order.'
			);
		}

		if (!request.name || !request.name.trim()) {
			throw new BadRequestException(
				'ORDER_APPROVAL_NAME_REQUIRED: an approval must say what it is about, for the approver to read.'
			);
		}

		if (!request.currency) {
			throw new BadRequestException(
				'ORDER_APPROVAL_CURRENCY_REQUIRED: an approval states the currency of its amount.'
			);
		}

		let amount: DecimalString | undefined;

		try {
			const normalized = normalizeDecimalString(
				typeof request.amount === 'number' ? request.amount : String(request.amount ?? '').trim()
			);

			amount = formatDecimalUnits(toUnitsAtScale(normalized, STORAGE_SCALE), STORAGE_SCALE);
		} catch {
			amount = undefined;
		}

		if (!amount || !isValidDecimalString(amount)) {
			throw new BadRequestException(
				`ORDER_APPROVAL_AMOUNT_NOT_DECIMAL: '${request.amount}' is not an exact decimal amount.`
			);
		}

		const saved = await this.requestApprovalService.createRequestApproval({
			name: request.name,
			requestId: request.orderId,
			requestType: ApprovalPolicyTypesStringEnum.SALES_ORDER,
			amount,
			currency: request.currency as never,
			note: request.note,
			organizationId: request.organizationId ?? RequestContext.currentOrganizationId(),
			min_count: 1
		});

		return { approvalId: saved.id };
	}

	/**
	 * @param orderId The order.
	 * @returns The order's request still awaiting a decision in the caller's tenant, or null.
	 */
	public async findOpen(orderId: ID): Promise<{ approvalId: ID } | null> {
		const [open] = await this.openRequests(orderId);

		return open ? { approvalId: open.id } : null;
	}

	/**
	 * Records the decision on every request of the order still awaiting one, through the approval service's
	 * own decision path — the one an administrator's approve and refuse use.
	 *
	 * @param orderId The order.
	 * @param approved True when the order was approved, false when it was refused.
	 * @returns How many requests were decided.
	 */
	public async settle(orderId: ID, approved: boolean): Promise<number> {
		const open = await this.openRequests(orderId);
		const status = approved ? RequestApprovalStatusTypesEnum.APPROVED : RequestApprovalStatusTypesEnum.REFUSED;

		for (const request of open) {
			await this.requestApprovalService.updateStatusRequestApprovalByAdmin(request.id, status);
		}

		return open.length;
	}

	/**
	 * @param orderId The order.
	 * @returns The order's requests awaiting a decision, read through the tenant-aware service.
	 */
	private async openRequests(orderId: ID): Promise<IRequestApproval[]> {
		return this.requestApprovalService.find({
			where: {
				requestId: orderId,
				requestType: ApprovalPolicyTypesStringEnum.SALES_ORDER,
				status: RequestApprovalStatusTypesEnum.REQUESTED
			}
		} as never);
	}
}
