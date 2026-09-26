import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import {
	IOrderClaimLineInput,
	IOrderFulfillmentPort,
	OrderClaimReason,
	OrderClaimStatus,
	RETURNS_ORDER_FULFILLMENT
} from '../returns.types';
import { normalizeQuantity, toQuantityUnits } from '../returns.quantity';
import { OrderClaim } from '../order-claim/order-claim.entity';
import { TypeOrmOrderClaimRepository } from '../order-claim/repository/type-orm-order-claim.repository';
import { OrderClaimLine } from './order-claim-line.entity';
import { MikroOrmOrderClaimLineRepository } from './repository/mikro-orm-order-claim-line.repository';
import { TypeOrmOrderClaimLineRepository } from './repository/type-orm-order-claim-line.repository';

/** The claim statuses in which its line set may still be written. */
const EDITABLE_STATUSES: OrderClaimStatus[] = [OrderClaimStatus.OPEN, OrderClaimStatus.REQUESTED];

/**
 * The lines of a claim.
 *
 * A claim line is not a return line: it may point at an order line (something the customer says was
 * wrong with what they received) or stand on its own as an additional item (a replacement part that
 * was never ordered). The two are different claims about the world, so the service derives
 * `isAdditionalItem` from what the line names rather than trusting a flag, and refuses a line that
 * names neither or both.
 *
 * A claim about an order line is checked against what was fulfilled, for the same reason a return is:
 * a customer cannot claim about an item that never shipped.
 */
@Injectable()
export class OrderClaimLineService extends TenantAwareCrudService<OrderClaimLine> {
	constructor(
		readonly typeOrmOrderClaimLineRepository: TypeOrmOrderClaimLineRepository,
		readonly mikroOrmOrderClaimLineRepository: MikroOrmOrderClaimLineRepository,
		readonly typeOrmOrderClaimRepository: TypeOrmOrderClaimRepository,
		@Optional()
		@Inject(RETURNS_ORDER_FULFILLMENT)
		private readonly fulfillment?: IOrderFulfillmentPort
	) {
		super(typeOrmOrderClaimLineRepository, mikroOrmOrderClaimLineRepository);
	}

	/**
	 * Reads the lines of a claim, scoped to the caller's tenant and organization.
	 *
	 * @param claimId The claim to read.
	 * @param withDeleted Whether lines retired by a later replacement write are included. Stated through
	 * the find options rather than as a filter on the returned rows, because the store is what knows a
	 * row was retired.
	 * @returns The lines, oldest first.
	 */
	public async findForClaim(claimId: ID, withDeleted?: boolean): Promise<OrderClaimLine[]> {
		return await this.typeOrmOrderClaimLineRepository.find({
			where: {
				claimId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { createdAt: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/**
	 * Replaces the line set of a claim that has not been decided yet.
	 *
	 * @param claimId The claim to write the lines of.
	 * @param inputs The claimed lines.
	 * @returns The written lines.
	 * @throws BadRequestException when the claim is not editable, or when a line names neither an
	 * order line nor a variant.
	 */
	public async replaceLines(claimId: ID, inputs: IOrderClaimLineInput[]): Promise<OrderClaimLine[]> {
		const claim = await this.readClaim(claimId);

		if (!EDITABLE_STATUSES.includes(claim.status)) {
			throw new BadRequestException(
				`The lines of a claim in status "${claim.status}" cannot be changed; only an open or requested claim can be edited.`
			);
		}

		if (!Array.isArray(inputs) || inputs.length === 0) {
			throw new BadRequestException('A claim needs at least one line.');
		}

		const framed = inputs.map((input) => this.frame(input));

		await this.assertOrderLinesWereFulfilled(claim.orderId, framed);

		await this.typeOrmOrderClaimLineRepository.softDelete({ claimId });

		const lines: OrderClaimLine[] = [];

		for (const input of framed) {
			lines.push(
				await super.create({
					claimId,
					orderLineId: input.orderLineId,
					variantId: input.variantId,
					quantity: normalizeQuantity(input.quantity),
					reason: input.reason ?? OrderClaimReason.OTHER,
					isAdditionalItem: input.isAdditionalItem,
					note: input.note,
					// The tenancy is the header's: `TenantAwareCrudService.create` states the tenant from the
					// request and no organization, and every scoped read of these lines filters by the
					// caller's organization — so a line written without one is invisible to the service that
					// wrote it, which is the defect this file's sibling in the return flow was fixed for.
					tenantId: claim.tenantId,
					organizationId: claim.organizationId
				} as any)
			);
		}

		return lines;
	}

	/**
	 * Derives what a claimed line is about and refuses a line that is ambiguous.
	 *
	 * @param input The claimed line.
	 * @returns The line with `isAdditionalItem` derived from what it names.
	 * @throws BadRequestException when the line names neither or both, or has no positive quantity.
	 */
	private frame(input: IOrderClaimLineInput): IOrderClaimLineInput & { isAdditionalItem: boolean } {
		if (toQuantityUnits(normalizeQuantity(input.quantity)) <= 0n) {
			throw new BadRequestException('A claim line must claim a positive quantity.');
		}

		if (input.orderLineId && input.variantId) {
			throw new BadRequestException(
				'A claim line names either the order line it is about or the replacement variant it asks for, not both.'
			);
		}

		if (!input.orderLineId && !input.variantId) {
			throw new BadRequestException(
				'A claim line must name the order line it is about, or the additional variant it asks for.'
			);
		}

		return { ...input, isAdditionalItem: !input.orderLineId };
	}

	/**
	 * Checks that every claimed order line was actually fulfilled on the order.
	 *
	 * @param orderId The order the claim is against.
	 * @param lines The framed lines.
	 * @throws BadRequestException when the order capability is missing, or when a line was never
	 * fulfilled.
	 */
	private async assertOrderLinesWereFulfilled(orderId: ID, lines: IOrderClaimLineInput[]): Promise<void> {
		const claimedOrderLineIds = lines.map((line) => line.orderLineId).filter((id): id is ID => !!id);

		if (!claimedOrderLineIds.length) {
			return;
		}

		if (!this.fulfillment) {
			throw new BadRequestException(
				'CLAIM_FULFILLMENT_UNAVAILABLE: the order capability is not registered, so a claim cannot be validated against what was fulfilled.'
			);
		}

		const fulfilled = await this.fulfillment.getFulfilledLines(orderId);
		const known = new Set((fulfilled ?? []).map((line) => line.orderLineId));

		for (const orderLineId of claimedOrderLineIds) {
			if (!known.has(orderLineId)) {
				throw new BadRequestException(
					`Order line ${orderLineId} was not fulfilled on this order, so it cannot be claimed.`
				);
			}
		}
	}

	/**
	 * @param claimId The claim to read.
	 * @returns The claim.
	 * @throws NotFoundException when it does not exist in this tenant and organization.
	 */
	private async readClaim(claimId: ID): Promise<OrderClaim> {
		const claim = await this.typeOrmOrderClaimRepository.findOne({
			where: {
				id: claimId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!claim) {
			throw new NotFoundException('The claim was not found.');
		}

		return claim;
	}
}
