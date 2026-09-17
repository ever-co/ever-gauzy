import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DecimalString, ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { PickList } from '../pick-list/pick-list.entity';
import { TypeOrmPickListRepository } from '../pick-list/repository/type-orm-pick-list.repository';
import {
	IPickOutcomeInput,
	ISubstitutionInput,
	IWarehouseStockLedgerPort,
	PickListLineStatus,
	PickListStatus,
	WAREHOUSE_STOCK_LEDGER,
	WarehouseStockMovementKind
} from '../warehouse.types';
import {
	fromQuantityUnits,
	isPositiveQuantity,
	normalizeQuantity,
	subtractQuantities,
	toQuantityUnits
} from '../warehouse.quantity';
import { PickListLine } from './pick-list-line.entity';
import { MikroOrmPickListLineRepository } from './repository/mikro-orm-pick-list-line.repository';
import { TypeOrmPickListLineRepository } from './repository/type-orm-pick-list-line.repository';

/**
 * The lines of a pick list: what was asked for, what was taken, and what the ledger has to be told.
 *
 * Three outcomes are recorded here and they are deliberately different things:
 *
 * - a **pick** took what the list asked for, and the ledger is already right, because the level was
 *   decremented when the shipment consumed its reservations;
 * - a **short pick** took less, which means the ledger is wrong — it believes goods are gone that were
 *   never on the shelf — so the missing quantity is written back through the inventory capability in
 *   the same transaction as the line;
 * - a **skip** is a decision on the floor rather than a stock count: the picker left the stock where it
 *   is, so nothing is corrected here and the shortfall is reported for a backorder or an adjustment
 *   request to be raised downstream.
 *
 * A substitution is recorded on the line as what was actually taken, and the price difference it may
 * imply is priced by the order change that authorises it — never here.
 */
@Injectable()
export class PickListLineService extends TenantAwareCrudService<PickListLine> {
	constructor(
		readonly typeOrmPickListLineRepository: TypeOrmPickListLineRepository,
		readonly mikroOrmPickListLineRepository: MikroOrmPickListLineRepository,
		private readonly typeOrmPickListRepository: TypeOrmPickListRepository,
		@Optional()
		@Inject(WAREHOUSE_STOCK_LEDGER)
		private readonly stockLedger?: IWarehouseStockLedgerPort
	) {
		super(typeOrmPickListLineRepository, mikroOrmPickListLineRepository);
	}

	/**
	 * Adds a line to a list.
	 *
	 * Lines are normally derived from a shipment; this path exists for a replenishment list, which
	 * serves no order, and for the corrected line an operator adds by hand.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	public async create(entity: Partial<PickListLine>): Promise<PickListLine> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const list = await this.findListOrFail(entity.pickListId);

		this.assertListAcceptsLines(list);

		if (!entity.variantId) {
			throw new BadRequestException('A pick line must name the variant to collect.');
		}

		if (!isPositiveQuantity(entity.quantityRequested)) {
			throw new BadRequestException('A pick line must request a positive quantity.');
		}

		const line = await super.create({
			...entity,
			quantityRequested: normalizeQuantity(entity.quantityRequested),
			quantityPicked: normalizeQuantity(entity.quantityPicked ?? 0),
			quantityShort: normalizeQuantity(entity.quantityShort ?? 0),
			status: entity.status ?? PickListLineStatus.PENDING,
			position: entity.position ?? 0,
			tenantId,
			organizationId
		} as any);

		await this.refreshListCounters(list.id);

		return line;
	}

	/**
	 * Records what the picker took from the bin.
	 *
	 * @param id The line.
	 * @param input What was picked.
	 * @returns The recorded line.
	 * @throws BadRequestException with `PICK_OVER_QUANTITY` when more was taken than the list asked
	 * for, which is a real error rather than a tolerance: the list is what the shipment needs.
	 */
	public async recordPick(id: ID, input: IPickOutcomeInput): Promise<PickListLine> {
		const line = await this.findOneScoped(id);
		const picked = toQuantityUnits(input.pickedQuantity);
		const requested = toQuantityUnits(line.quantityRequested);

		if (picked > requested) {
			throw new BadRequestException(
				`PICK_OVER_QUANTITY: ${fromQuantityUnits(picked)} was recorded against a line that asks for ${fromQuantityUnits(requested)}.`
			);
		}

		if (line.status !== PickListLineStatus.PENDING) {
			throw new BadRequestException(
				`A line in status "${line.status}" already has an outcome and cannot be picked again.`
			);
		}

		const shortfall = requested - picked;

		// The one place picking touches stock: a bin that held less than the list asked for is a stock
		// error, and the ledger has to learn about it in the same transaction as the line.
		if (shortfall > 0n) {
			await this.correctShortfall(line, fromQuantityUnits(shortfall));
		}

		await super.update(id, {
			binId: input.binId ?? line.binId,
			quantityPicked: fromQuantityUnits(picked),
			quantityShort: fromQuantityUnits(shortfall),
			status: shortfall > 0n ? PickListLineStatus.SHORT : PickListLineStatus.PICKED,
			pickedAt: new Date(),
			pickedByUserId: RequestContext.currentUserId(),
			lotNumber: input.lotNumber ?? line.lotNumber,
			serialNumbers: input.serialNumbers ?? line.serialNumbers,
			note: input.note ?? line.note
		} as any);

		await this.refreshListCounters(line.pickListId);

		return await this.findOneScoped(id);
	}

	/**
	 * Records a substitute: a different unit was taken instead of the one the list named.
	 *
	 * The line becomes `PICKED` — the pick succeeded, and the state machine answers "is this list
	 * finished?" rather than "was it exactly what the customer ordered". The two movements the swap
	 * implies are written through the ledger: the original variant goes back on the level it was
	 * believed to have left, and the substitute comes off the one it was taken from.
	 *
	 * @param id The line.
	 * @param input The substitute the picker took.
	 * @returns The recorded line.
	 * @throws BadRequestException when the substitute and its quantity are not stated together, or when
	 * there is something to move and no inventory capability is registered.
	 */
	public async recordSubstitution(id: ID, input: ISubstitutionInput): Promise<PickListLine> {
		const line = await this.findOneScoped(id);

		if (line.status !== PickListLineStatus.PENDING) {
			throw new BadRequestException(
				`A line in status "${line.status}" already has an outcome and cannot be substituted.`
			);
		}

		if (!input.substituteVariantId || !isPositiveQuantity(input.substituteQuantity)) {
			throw new BadRequestException('A substitution must name the variant taken and a positive quantity.');
		}

		if (toQuantityUnits(input.substituteQuantity) > toQuantityUnits(line.quantityRequested)) {
			throw new BadRequestException(
				'PICK_OVER_QUANTITY: a substitution may not take more than the line asks for.'
			);
		}

		const binId = input.binId ?? line.binId;

		await this.writeSubstitutionMovements(line, input, binId);

		await super.update(id, {
			binId,
			substituteVariantId: input.substituteVariantId,
			substituteQuantity: normalizeQuantity(input.substituteQuantity),
			substitutionReason: input.substitutionReason,
			status: PickListLineStatus.PICKED,
			pickedAt: new Date(),
			pickedByUserId: RequestContext.currentUserId(),
			note: input.note ?? line.note
		} as any);

		await this.refreshListCounters(line.pickListId);

		return await this.findOneScoped(id);
	}

	/**
	 * Records a line the picker deliberately did not collect.
	 *
	 * No stock is corrected: the goods are still on the shelf, and the reason is a decision — damage, a
	 * blocked position, a pallet that could not be reached. The shortfall is recorded so the decision
	 * downstream is made with the number in hand.
	 *
	 * @param id The line.
	 * @param note Why it was skipped.
	 * @returns The recorded line.
	 */
	public async recordSkip(id: ID, note?: string): Promise<PickListLine> {
		const line = await this.findOneScoped(id);

		if (line.status !== PickListLineStatus.PENDING) {
			throw new BadRequestException(
				`A line in status "${line.status}" already has an outcome and cannot be skipped.`
			);
		}

		await super.update(id, {
			quantityShort: normalizeQuantity(line.quantityRequested),
			status: PickListLineStatus.SKIPPED,
			pickedAt: new Date(),
			pickedByUserId: RequestContext.currentUserId(),
			note: note ?? line.note
		} as any);

		await this.refreshListCounters(line.pickListId);

		return await this.findOneScoped(id);
	}

	/**
	 * Attaches the picked lines of a list to a pack slip.
	 *
	 * @param pickListId The list whose lines are packed.
	 * @param packSlipId The slip they go into.
	 * @returns The lines that were attached.
	 */
	public async attachToPackSlip(pickListId: ID, packSlipId: ID): Promise<PickListLine[]> {
		const lines = await this.findForList(pickListId);
		const attachable = lines.filter((line) =>
			[PickListLineStatus.PICKED, PickListLineStatus.SHORT, PickListLineStatus.SKIPPED].includes(line.status)
		);

		for (const line of attachable) {
			await super.update(line.id, { packSlipId } as any);
		}

		return attachable;
	}

	/**
	 * Detaches the lines of a slip, which is what cancelling one does.
	 *
	 * The lines themselves are never edited back: the picked quantity is what physically happened, and a
	 * cancellation is a statement about the package, not about the walking.
	 *
	 * @param packSlipId The slip being cancelled.
	 */
	public async detachFromPackSlip(packSlipId: ID): Promise<void> {
		const lines = await this.typeOrmPickListLineRepository.find({
			where: {
				packSlipId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		for (const line of lines) {
			await super.update(line.id, { packSlipId: null } as any);
		}
	}

	/**
	 * Reads the lines of a list, in the order the pick path visits them.
	 *
	 * @param pickListId The list.
	 * @returns The lines.
	 */
	public async findForList(pickListId: ID): Promise<PickListLine[]> {
		return await this.typeOrmPickListLineRepository.find({
			where: {
				pickListId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { bin: true, zone: true },
			order: { position: 'ASC' }
		});
	}

	/**
	 * Reads a line inside the caller's tenant and organization.
	 *
	 * @param id The line to read.
	 * @returns The line.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<PickListLine> {
		const line = await this.typeOrmPickListLineRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!line) {
			throw new NotFoundException('The pick line was not found.');
		}

		return line;
	}

	/**
	 * Recomputes the caches of the list a line belongs to, and promotes it to `IN_PROGRESS`.
	 *
	 * The counters are re-derived from the lines rather than incremented, because a counter that drifts
	 * is worse than no counter: it is believed.
	 *
	 * @param pickListId The list.
	 */
	private async refreshListCounters(pickListId: ID): Promise<void> {
		const list = await this.typeOrmPickListRepository.findOne({
			where: {
				id: pickListId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!list) {
			return;
		}

		const lines = await this.findForList(pickListId);

		await this.typeOrmPickListRepository.update(pickListId, {
			lineCount: lines.length,
			pickedCount: lines.filter((line) =>
				[PickListLineStatus.PICKED, PickListLineStatus.SHORT].includes(line.status)
			).length,
			shortCount: lines.filter((line) =>
				[PickListLineStatus.SHORT, PickListLineStatus.SKIPPED].includes(line.status)
			).length,
			...(list.status === PickListStatus.PENDING || list.status === PickListStatus.ASSIGNED
				? { status: PickListStatus.IN_PROGRESS, startedAt: list.startedAt ?? new Date() }
				: {})
		} as any);
	}

	/**
	 * Writes a shortfall back through the inventory capability.
	 *
	 * @param line The line that came up short.
	 * @param shortfall The quantity the bin did not hold.
	 * @throws BadRequestException when there is something to correct and no ledger is registered.
	 */
	private async correctShortfall(line: PickListLine, shortfall: DecimalString): Promise<void> {
		if (!this.stockLedger) {
			throw new BadRequestException(
				'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so the shortfall cannot be written back to stock.'
			);
		}

		if (!line.binId) {
			throw new BadRequestException(
				`Pick line ${line.id} has no bin, so the shortfall has nowhere to be corrected against.`
			);
		}

		const list = await this.findListOrFail(line.pickListId);

		await this.stockLedger.recordMovement({
			warehouseId: list.warehouseId,
			variantId: line.variantId,
			binId: line.binId,
			quantity: shortfall,
			kind: WarehouseStockMovementKind.ADJUSTMENT,
			referenceType: 'PICK_LIST_LINE',
			referenceId: line.id,
			reason: 'SHORT_PICK: the bin held less than the pick list asked for.'
		});
	}

	/**
	 * Writes the two movements a substitution implies.
	 *
	 * @param line The line that was substituted.
	 * @param input The substitute.
	 * @param binId The bin the substitute was taken from.
	 * @throws BadRequestException when there is something to move and no ledger is registered.
	 */
	private async writeSubstitutionMovements(
		line: PickListLine,
		input: ISubstitutionInput,
		binId?: ID
	): Promise<void> {
		if (!this.stockLedger) {
			throw new BadRequestException(
				'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so the swapped quantities cannot be written to the ledger.'
			);
		}

		if (!binId) {
			throw new BadRequestException(
				`Pick line ${line.id} has no bin, so the substitution has nowhere to be recorded against.`
			);
		}

		const list = await this.findListOrFail(line.pickListId);
		const quantity = normalizeQuantity(input.substituteQuantity);

		await this.stockLedger.recordMovement({
			warehouseId: list.warehouseId,
			variantId: line.variantId,
			binId,
			quantity,
			kind: WarehouseStockMovementKind.ADJUSTMENT,
			referenceType: 'PICK_LIST_LINE',
			referenceId: line.id,
			reason: 'SUBSTITUTION: the requested variant was not taken, so it goes back on the level.'
		});

		await this.stockLedger.recordMovement({
			warehouseId: list.warehouseId,
			variantId: input.substituteVariantId,
			binId,
			quantity: subtractQuantities(0, quantity),
			kind: WarehouseStockMovementKind.SALE,
			referenceType: 'PICK_LIST_LINE',
			referenceId: line.id,
			reason: 'SUBSTITUTION: the substitute variant left the building instead.'
		});
	}

	/**
	 * @param pickListId The list, when one was named.
	 * @returns The list.
	 * @throws BadRequestException when no list was named or it does not exist.
	 */
	private async findListOrFail(pickListId?: ID): Promise<PickList> {
		if (!pickListId) {
			throw new BadRequestException('A pick line belongs to a list and must name it.');
		}

		const list = await this.typeOrmPickListRepository.findOne({
			where: {
				id: pickListId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!list) {
			throw new BadRequestException('The pick list named for this line does not exist.');
		}

		return list;
	}

	/**
	 * @param list The list a line is being added to.
	 * @throws BadRequestException when the list can no longer accept lines.
	 */
	private assertListAcceptsLines(list: PickList): void {
		if ([PickListStatus.PICKED, PickListStatus.CANCELED].includes(list.status)) {
			throw new BadRequestException(
				`A pick list in status "${list.status}" is closed and cannot accept lines.`
			);
		}
	}
}
