import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { FindOptionsWhere, ObjectLiteral, Repository, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DecimalString, ID } from '@gauzy/contracts';
import { EventOutboxService, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { PickList } from '../pick-list/pick-list.entity';
import { TypeOrmPickListRepository } from '../pick-list/repository/type-orm-pick-list.repository';
import {
	IPickOutcomeInput,
	ISubstitutionInput,
	IWarehouseStockLedgerPort,
	PICK_LIST_EVENTS,
	PickListLineStatus,
	PickListStatus,
	WAREHOUSE_STOCK_LEDGER,
	WarehouseStockMovementKind
} from '../warehouse.types';
import { editByIdOnly, landEdit, warehouseEditOf } from '../warehouse.writable';
import {
	fromQuantityUnits,
	isPositiveQuantity,
	normalizeQuantity,
	subtractQuantities,
	toQuantityUnits
} from '../warehouse.quantity';
import { IWarehouseTransaction, TWarehouseRows, runWarehouseTransaction, warehouseRowsOf } from '../warehouse-persistence';
import { TWarehouseTransactionRunner, movePickList } from '../pick-list/pick-list-moves';
import { PickListLine } from './pick-list-line.entity';
import { MikroOrmPickListLineRepository } from './repository/mikro-orm-pick-list-line.repository';
import { TypeOrmPickListLineRepository } from './repository/type-orm-pick-list-line.repository';

/**
 * The lines of a pick list: what was asked for, what was taken, and what the ledger has to be told.
 *
 * Three outcomes are recorded here and they are deliberately different things:
 *
 * - a **pick** took what the list asked for, and picking writes nothing;
 * - a **short pick** took less, which means the ledger is wrong — it holds units the bin never had — so
 *   the missing quantity is written off through the inventory capability with the line (review R2-14:
 *   see `correctShortfall` for the sign, and for what it assumes about the sale side);
 * - a **skip** is a decision on the floor rather than a stock count: the picker left the stock where it
 *   is, so nothing is corrected here and the shortfall is reported for a backorder or an adjustment
 *   request to be raised downstream.
 *
 * A substitution is recorded on the line as what was actually taken, and the price difference it may
 * imply is priced by the order change that authorises it — never here.
 */
/**
 * What an edit of a pick line may change (review R2-13): its note and its free-form metadata. Its outcome — the status,
 * the picked and short quantities, the substitute, the pick facts — is written by pick, substitute and skip, each of
 * which writes the stock movement it implies; its position, bin and quantity are the list's route, frozen once a
 * picker owns it; its slip is attached and detached by packing.
 */
const PICK_LIST_LINE_WRITABLE_MEMBERS = ['note', 'metadata'] as const;

@Injectable()
export class PickListLineService extends TenantAwareCrudService<PickListLine> {
	constructor(
		readonly typeOrmPickListLineRepository: TypeOrmPickListLineRepository,
		readonly mikroOrmPickListLineRepository: MikroOrmPickListLineRepository,
		private readonly typeOrmPickListRepository: TypeOrmPickListRepository,
		private readonly outbox: EventOutboxService,
		@Optional()
		@Inject(WAREHOUSE_STOCK_LEDGER)
		private readonly stockLedger?: IWarehouseStockLedgerPort
	) {
		super(typeOrmPickListLineRepository, mikroOrmPickListLineRepository);
	}

	/**
	 * Runs one write in a transaction on the ORM the installation runs, on this service's repositories.
	 *
	 * @param work The transaction body.
	 * @returns What the body answers.
	 */
	private readonly transaction: TWarehouseTransactionRunner = (work) =>
		runWarehouseTransaction(
			this.ormType,
			() => this.typeOrmPickListRepository.manager,
			() => this.mikroOrmPickListLineRepository,
			work
		);

	/**
	 * Edits a pick line, refusing its outcome and its route (review R2-13).
	 *
	 * `PUT /pick-list-lines/:id` reached the inherited update with a body that declares the status and the picked and
	 * short quantities, so a line recorded `SHORT` — which wrote its shortfall movement — could be put back to
	 * `PENDING` and picked again, writing a second movement. Only `PICK_LIST_LINE_WRITABLE_MEMBERS` are written; any
	 * other member the body would move is refused with `PICK_LIST_LINE_FIELD_NOT_WRITABLE`.
	 *
	 * @param id The line.
	 * @param partialEntity The members to change.
	 * @returns The update result, or the line as stored when the edit changed nothing.
	 * @throws BadRequestException with `PICK_LIST_LINE_FIELD_NOT_WRITABLE`.
	 */
	public async update(
		id: ID | FindOptionsWhere<PickListLine>,
		partialEntity: QueryDeepPartialEntity<PickListLine>
	): Promise<PickListLine | UpdateResult> {
		if (typeof id !== 'string') {
			throw editByIdOnly('PICK_LIST_LINE_FIELD_NOT_WRITABLE', 'A pick line');
		}

		const stored = await this.findOneScoped(id);
		const edit = warehouseEditOf(stored, partialEntity as Record<string, unknown>, PICK_LIST_LINE_WRITABLE_MEMBERS, {
			code: 'PICK_LIST_LINE_FIELD_NOT_WRITABLE',
			document: 'pick line',
			operations: 'an outcome is recorded through pick, substitute and skip, and the route is fixed when the list is released.'
		});

		if (!Object.keys(edit).length) {
			return stored;
		}

		// Predicated on the status the check read, so an operation that moved the document meanwhile is not overwritten.
		return await landEdit(
			() => super.update({ id, status: stored.status } as FindOptionsWhere<PickListLine>, edit as QueryDeepPartialEntity<PickListLine>),
			'PICK_LIST_LINE_EDIT_CONFLICT',
			'pick line',
			id
		);
	}

	/**
	 * Closes a line that never got an outcome, because its list was cancelled. The list's cancellation is the one
	 * caller; it writes the status through the base class, which the guarded edit above refuses.
	 *
	 * Handed the cancellation's transaction, the line is withdrawn inside it — so the list's status, its lines and
	 * the `pick_list.canceled` fact commit together — and only while it is still open: a line that got an outcome
	 * since the cancellation read it is refused with `PICK_LIST_LINE_EDIT_CONFLICT`, which takes the cancellation
	 * back (a list with recorded outcomes is closed short, never cancelled).
	 *
	 * @param id The line.
	 * @param transaction The transaction of the list's cancellation, when it runs in one.
	 * @throws ConflictException with `PICK_LIST_LINE_EDIT_CONFLICT` when, inside a transaction, the line is no longer open.
	 */
	public async cancelOpenLine(id: ID, transaction?: IWarehouseTransaction): Promise<void> {
		if (!transaction) {
			await super.update(id, { status: PickListLineStatus.CANCELED } as QueryDeepPartialEntity<PickListLine>);

			return;
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		await landEdit(
			() =>
				transaction.rows(PickListLine).update(
					{
						id,
						status: PickListLineStatus.PENDING,
						...(tenantId ? { tenantId } : {}),
						...(organizationId ? { organizationId } : {})
					} as FindOptionsWhere<PickListLine>,
					{ status: PickListLineStatus.CANCELED } as QueryDeepPartialEntity<PickListLine>
				),
			'PICK_LIST_LINE_EDIT_CONFLICT',
			'pick line',
			id
		);
	}

	/**
	 * The repository one of this package's tables is read and edited through outside the platform's CRUD
	 * path, on the ORM the installation runs: the TypeORM repository itself under TypeORM — the call it
	 * always was — and the same calls answered through MikroORM under MikroORM, through this service's own
	 * MikroORM repository's entity manager (`warehouse-persistence.ts`).
	 *
	 * @param entity The table's entity.
	 * @param typeOrm Its TypeORM repository, reached only under TypeORM.
	 * @returns The repository.
	 */
	private rows<T extends ObjectLiteral>(entity: new () => T, typeOrm: () => Repository<T>): TWarehouseRows<T> {
		return warehouseRowsOf(this.ormType, entity, typeOrm, () => this.mikroOrmPickListLineRepository);
	}

	/**
	 * Adds a line to a list.
	 *
	 * Lines are normally derived from a shipment; this path exists for a replenishment list, which
	 * serves no order, and for the corrected line an operator adds by hand.
	 *
	 * The list's counters are re-derived, and that is all: a line arriving does not start the work, so a
	 * list that was unassigned when its lines were written is still unassigned and may still be given to
	 * a picker.
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

		await this.refreshListCounters(list.id, false);

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
		const lines = await this.rows(PickListLine, () => this.typeOrmPickListLineRepository).find({
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
	 * @param options Whether retired lines are included; the store's own find options carry the flag, so
	 * it is stated rather than applied here.
	 * @returns The lines.
	 */
	public async findForList(pickListId: ID, options: { withDeleted?: boolean } = {}): Promise<PickListLine[]> {
		return await this.rows(PickListLine, () => this.typeOrmPickListLineRepository).find({
			where: {
				pickListId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { bin: true, zone: true },
			order: { position: 'ASC' },
			...(options.withDeleted ? { withDeleted: true } : {})
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
		const line = await this.rows(PickListLine, () => this.typeOrmPickListLineRepository).findOne({
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
	 * Recomputes the caches of the list a line belongs to, and promotes it to `IN_PROGRESS` when the
	 * change is an outcome rather than the arrival of a line.
	 *
	 * The counters are re-derived from the lines rather than incremented, because a counter that drifts
	 * is worse than no counter: it is believed.
	 *
	 * Putting a line on a list is not the work starting, and the difference is load-bearing: a list
	 * derived from shipments is written with its lines already on it, so a promotion here would make
	 * every derived list be walked before a picker had been near it — and a list that is being walked
	 * can no longer be assigned to one. The promotion belongs to the first outcome recorded against a
	 * line, which is what `startsWork` states.
	 *
	 * **The promotion is a move of the list, and is announced like one** (`movePickList`): the status, the counters,
	 * the next version and `pick_list.started` in one transaction, predicated on the status and the version this
	 * refresh read — so the first outcome announces the start exactly once. A concurrent first outcome on another
	 * line that already moved the list is not this pick's failure: the line was recorded, so the promotion is skipped
	 * quietly and the counters are re-derived as for any later outcome. A refresh that moves no status stays what it
	 * was — counters only, no event, no version.
	 *
	 * @param pickListId The list.
	 * @param startsWork Whether the change is an outcome recorded on a line.
	 */
	private async refreshListCounters(pickListId: ID, startsWork = true): Promise<void> {
		const list = await this.rows(PickList, () => this.typeOrmPickListRepository).findOne({
			where: {
				id: pickListId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!list) {
			return;
		}

		if (startsWork && (list.status === PickListStatus.PENDING || list.status === PickListStatus.ASSIGNED)) {
			const started = await movePickList(this.transaction, this.outbox, list, {
				name: PICK_LIST_EVENTS.STARTED,
				patch: {
					...this.countersOf(await this.findForList(pickListId)),
					status: PickListStatus.IN_PROGRESS,
					startedAt: list.startedAt ?? new Date(),
					version: (list.version ?? 1) + 1
				},
				whenMoved: 'skip'
			});

			if (started) {
				return;
			}
		}

		await this.rows(PickList, () => this.typeOrmPickListRepository).update(
			pickListId,
			this.countersOf(await this.findForList(pickListId)) as any
		);
	}

	/**
	 * The counters a list caches, re-derived from its lines.
	 *
	 * @param lines The list's lines.
	 * @returns The counters.
	 */
	private countersOf(lines: PickListLine[]): Pick<PickList, 'lineCount' | 'pickedCount' | 'shortCount'> {
		return {
			lineCount: lines.length,
			pickedCount: lines.filter((line) =>
				[PickListLineStatus.PICKED, PickListLineStatus.SHORT].includes(line.status)
			).length,
			shortCount: lines.filter((line) =>
				[PickListLineStatus.SHORT, PickListLineStatus.SKIPPED].includes(line.status)
			).length
		};
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
			// A write-off, not a write-back (review R2-14). The bin was believed to hold what the list asked for and
			// held less, so the book carries `shortfall` units nobody can pick: they come off, and on-hand meets the
			// shelf. The correction used to be `+shortfall`, on the premise that the shipment had already consumed
			// the requested units — but nothing consumes stock before or at picking (review R2-05: the reservation
			// is never consumed), so every short pick raised on-hand by the units that were missing. When R2-05 wires
			// the sale side, this and the substitution below are revisited together: a shipment that consumed the
			// requested quantity has already taken these units off, and this write-off would then be a second one.
			quantity: subtractQuantities(0, shortfall),
			kind: WarehouseStockMovementKind.ADJUSTMENT,
			referenceType: 'PICK_LIST_LINE',
			referenceId: line.id,
			reason: 'SHORT_PICK: the bin held less than the pick list asked for; the units it never had are written off.'
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

		const list = await this.rows(PickList, () => this.typeOrmPickListRepository).findOne({
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
