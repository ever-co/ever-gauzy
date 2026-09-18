import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { Money, RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import {
	IOrderClaimLineInput,
	IRefundGatewayPort,
	IRefundResult,
	OrderClaimStatus,
	OrderClaimType,
	RETURNS_REFUND_GATEWAY
} from '../returns.types';
import { OrderClaimLineService } from '../order-claim-line/order-claim-line.service';
import { OrderClaimLine } from '../order-claim-line/order-claim-line.entity';
import { TypeOrmOrderExchangeRepository } from '../order-exchange/repository/type-orm-order-exchange.repository';
import { OrderClaim } from './order-claim.entity';
import { MikroOrmOrderClaimRepository } from './repository/mikro-orm-order-claim.repository';
import { TypeOrmOrderClaimRepository } from './repository/type-orm-order-claim.repository';

/** The series key claims are numbered from. */
const CLAIM_NUMBER_KEY = 'CLAIM';

/** Statuses a claim may still be decided from. */
const DECIDABLE_STATUSES: OrderClaimStatus[] = [OrderClaimStatus.OPEN, OrderClaimStatus.REQUESTED];

/**
 * A complaint about a delivered order and the resolution chosen for it.
 *
 * The resolution is what makes a claim a domain rather than a note. A `REFUND` claim settles in money
 * and closes as soon as the refund is written; a `REPLACE` claim settles in goods, so it is approved
 * once there is something to ship — at least one additional item or a linked exchange — and closed
 * when the replacement has gone out. A replacement claim with neither is refused, because approving it
 * would put the claim in a state where nothing can ever happen next.
 *
 * Money never moves from here: the refund is issued through the payment capability's port, and the
 * amount is normalised at the currency's scale through the platform money layer first.
 */
@Injectable()
export class OrderClaimService extends TenantAwareCrudService<OrderClaim> {
	constructor(
		readonly typeOrmOrderClaimRepository: TypeOrmOrderClaimRepository,
		readonly mikroOrmOrderClaimRepository: MikroOrmOrderClaimRepository,
		readonly typeOrmOrderExchangeRepository: TypeOrmOrderExchangeRepository,
		private readonly lineService: OrderClaimLineService,
		private readonly sequenceService: SequenceService,
		@Optional()
		@Inject(RETURNS_REFUND_GATEWAY)
		private readonly refundGateway?: IRefundGatewayPort
	) {
		super(typeOrmOrderClaimRepository, mikroOrmOrderClaimRepository);
	}

	/**
	 * Raises a claim against an order.
	 *
	 * @param entity The claim to create, with its claimed lines.
	 * @returns The created claim, with its lines.
	 */
	public async create(
		entity: Partial<OrderClaim> & { lines?: IOrderClaimLineInput[] }
	): Promise<OrderClaim> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const { lines = [], ...header } = entity;

		if (!header.orderId) {
			throw new BadRequestException('A claim must name the order it is about.');
		}

		if (!header.currency) {
			throw new BadRequestException('A claim must state the currency its amounts are in.');
		}

		if (!lines.length) {
			throw new BadRequestException('A claim needs at least one line.');
		}

		const number = await this.allocateNumber();

		const claim = await super.create({
			...header,
			number,
			type: header.type ?? OrderClaimType.REFUND,
			status: OrderClaimStatus.OPEN,
			refundAmount:
				header.refundAmount === undefined || header.refundAmount === null || String(header.refundAmount) === ''
					? undefined
					: Money.of(String(header.refundAmount), header.currency).round().toStorageString(),
			tenantId,
			organizationId
		} as any);

		claim.lines = await this.lineService.replaceLines(claim.id, lines);

		return claim;
	}

	/**
	 * Replaces the line set of a claim that has not been decided yet.
	 *
	 * The lines are owned by `OrderClaimLineService`, which derives what each line is about and checks
	 * it against the order; this method exists so a caller holding the claim can edit it without
	 * reaching for another service.
	 *
	 * @param id The claim to write the lines of.
	 * @param lines The claimed lines.
	 * @returns The written lines.
	 */
	public async replaceLines(id: ID, lines: IOrderClaimLineInput[]): Promise<OrderClaimLine[]> {
		return await this.lineService.replaceLines(id, lines);
	}

	/**
	 * Approves a claim and settles it as far as its type allows.
	 *
	 * A `REFUND` claim is settled here — the refund is issued and the claim closes, because nothing
	 * else has to happen. A `REPLACE` claim is approved and left open until the replacement shipment
	 * exists, which is another domain's work; `close` is what finishes it.
	 *
	 * @param id The claim to approve.
	 * @param refundAmount The amount to refund, for a `REFUND` claim.
	 * @param note An operator note.
	 * @returns The claim and the refund, when one was issued.
	 */
	public async approve(
		id: ID,
		refundAmount?: string | number,
		note?: string
	): Promise<{ claim: OrderClaim; refund?: IRefundResult }> {
		const claim = await this.findOneScoped(id);

		this.assertStatus(claim, DECIDABLE_STATUSES, 'approve');

		const lines = await this.lineService.findForClaim(id);
		const canBeShipped = lines.some((line) => line.isAdditionalItem === true) || (await this.hasLinkedExchange(claim));

		if (claim.type === OrderClaimType.REPLACE && !canBeShipped) {
			throw new BadRequestException(
				'A replacement claim must have at least one additional item or a linked exchange, otherwise there is nothing to ship.'
			);
		}

		if (claim.type === OrderClaimType.REFUND) {
			const refund = await this.settleRefund(claim, refundAmount, note);

			await super.update(id, {
				status: OrderClaimStatus.CLOSED,
				refundAmount: refund.amount,
				note: note ?? claim.note
			} as any);

			return { claim: await this.findOneScoped(id), refund };
		}

		await super.update(id, {
			status: OrderClaimStatus.APPROVED,
			note: note ?? claim.note
		} as any);

		return { claim: await this.findOneScoped(id) };
	}

	/**
	 * Rejects a claim. Terminal.
	 *
	 * @param id The claim to reject.
	 * @param reason Why it was rejected.
	 * @returns The rejected claim.
	 */
	public async reject(id: ID, reason?: string): Promise<OrderClaim> {
		const claim = await this.findOneScoped(id);

		this.assertStatus(claim, [...DECIDABLE_STATUSES, OrderClaimStatus.APPROVED], 'reject');

		await super.update(id, {
			status: OrderClaimStatus.REJECTED,
			reason: reason ?? claim.reason
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Cancels a claim.
	 *
	 * @param id The claim to cancel.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled claim.
	 */
	public async cancel(id: ID, reason?: string): Promise<OrderClaim> {
		const claim = await this.findOneScoped(id);

		this.assertStatus(claim, [...DECIDABLE_STATUSES, OrderClaimStatus.APPROVED], 'cancel');

		await super.update(id, {
			status: OrderClaimStatus.CANCELED,
			canceledAt: new Date(),
			reason: reason ?? claim.reason
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Closes an approved claim whose replacement has been shipped.
	 *
	 * @param id The claim to close.
	 * @param note An operator note.
	 * @returns The closed claim.
	 */
	public async close(id: ID, note?: string): Promise<OrderClaim> {
		const claim = await this.findOneScoped(id);

		if (claim.status === OrderClaimStatus.CLOSED) {
			return claim;
		}

		this.assertStatus(claim, [OrderClaimStatus.APPROVED], 'close');

		await super.update(id, {
			status: OrderClaimStatus.CLOSED,
			note: note ?? claim.note
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Reads a claim with everything a detail view shows.
	 *
	 * @param id The claim to read.
	 * @returns The claim, its lines and its linked return.
	 */
	public async findOneDetailed(id: ID): Promise<OrderClaim> {
		const claim = await this.typeOrmOrderClaimRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { lines: true, return: true }
		});

		if (!claim) {
			throw new NotFoundException('The claim was not found.');
		}

		return claim;
	}

	/**
	 * Links the return that brings the faulty goods back, which is what lets a replacement claim be
	 * approved.
	 *
	 * @param id The claim.
	 * @param returnId The return.
	 * @returns The updated claim.
	 */
	public async linkReturn(id: ID, returnId: ID): Promise<OrderClaim> {
		await this.findOneScoped(id);

		await super.update(id, { returnId } as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Reads whether the claim's return is the inbound half of an exchange, which is the other way a
	 * replacement claim can have something to ship.
	 *
	 * The claim and the exchange are linked through the return rather than to each other: the claim
	 * asks for replacement goods, the return brings the faulty ones back, and the exchange is what
	 * ships the replacements against that return.
	 *
	 * @param claim The claim being approved.
	 * @returns True when an exchange exists for the claim's return.
	 */
	private async hasLinkedExchange(claim: OrderClaim): Promise<boolean> {
		if (!claim.returnId) {
			return false;
		}

		const exchange = await this.typeOrmOrderExchangeRepository.findOne({
			where: {
				returnId: claim.returnId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			select: { id: true }
		});

		return !!exchange;
	}

	/**
	 * Issues the refund a `REFUND` claim resolves to.
	 *
	 * @param claim The claim being settled.
	 * @param refundAmount The requested amount; the claim's own amount is used when it is omitted.
	 * @param note An operator note.
	 * @returns The refund that was written.
	 * @throws BadRequestException when no amount is known or no payment capability is registered.
	 */
	private async settleRefund(
		claim: OrderClaim,
		refundAmount: string | number | undefined,
		note?: string
	): Promise<IRefundResult> {
		const requested = refundAmount ?? claim.refundAmount;

		if (requested === undefined || requested === null || String(requested) === '') {
			throw new BadRequestException('A refund claim needs an amount before it can be settled.');
		}

		if (!this.refundGateway) {
			throw new BadRequestException(
				'CLAIM_REFUND_UNAVAILABLE: the payment capability is not registered, so the refund cannot be issued.'
			);
		}

		const refundable = Money.of(String(requested), claim.currency).round();

		if (!refundable.isPositive()) {
			throw new BadRequestException('A refund must be for a positive amount.');
		}

		return await this.refundGateway.createRefund({
			orderId: claim.orderId,
			// Which of the three post-purchase flows owes this money, so a refund that names no return
			// and no exchange is still attributable to the claim that produced it.
			claimId: claim.id,
			amount: refundable.toStorageString(),
			currency: claim.currency,
			note
		});
	}

	/**
	 * Allocates the next claim number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(CLAIM_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			throw new BadRequestException(
				`No numbering series is configured for claims (key "${CLAIM_NUMBER_KEY}"), so a claim number cannot be allocated.`
			);
		}
	}

	/**
	 * @param id The claim to read.
	 * @returns The claim, when it belongs to the caller's tenant and organization.
	 * @throws NotFoundException when it does not.
	 */
	private async findOneScoped(id: ID): Promise<OrderClaim> {
		const claim = await this.typeOrmOrderClaimRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!claim) {
			throw new NotFoundException('The claim was not found.');
		}

		return claim;
	}

	/**
	 * @param claim The claim the transition is attempted on.
	 * @param allowed The statuses it may be attempted from.
	 * @param action The action being attempted, named in the error.
	 * @throws BadRequestException when the claim is not in one of the allowed statuses.
	 */
	private assertStatus(claim: OrderClaim, allowed: OrderClaimStatus[], action: string): void {
		if (!allowed.includes(claim.status)) {
			throw new BadRequestException(
				`A claim in status "${claim.status}" cannot ${action}; expected ${allowed.join(' or ')}.`
			);
		}
	}
}
