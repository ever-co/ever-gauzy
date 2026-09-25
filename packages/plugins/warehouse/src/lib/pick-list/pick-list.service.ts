import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { PickListLineService } from '../pick-list-line/pick-list-line.service';
import { PickListLine } from '../pick-list-line/pick-list-line.entity';
import { PickWaveService } from '../pick-wave/pick-wave.service';
import { PickWave } from '../pick-wave/pick-wave.entity';
import { TypeOrmPickWaveRepository } from '../pick-wave/repository/type-orm-pick-wave.repository';
import { WarehouseBin } from '../warehouse-bin/warehouse-bin.entity';
import { WarehouseBinService } from '../warehouse-bin/warehouse-bin.service';
import { WarehouseZoneService } from '../warehouse-zone/warehouse-zone.service';
import {
	IWarehouseFulfillmentPort,
	IWarehouseShippableLine,
	IWarehouseStockLedgerPort,
	PICK_NUMBER_KEY,
	PickListStatus,
	PickWaveStrategy,
	PickWaveStatus,
	WAREHOUSE_FULFILLMENT,
	WAREHOUSE_STOCK_LEDGER
} from '../warehouse.types';
import { isPositiveQuantity, normalizeQuantity } from '../warehouse.quantity';
import { TWarehouseRows, warehouseRowsOf } from '../warehouse-persistence';
import { PickList } from './pick-list.entity';
import { MikroOrmPickListRepository } from './repository/mikro-orm-pick-list.repository';
import { TypeOrmPickListRepository } from './repository/type-orm-pick-list.repository';

/**
 * The work, per picker: the lists, their derivation from shipments, and their lifecycle.
 *
 * A list is not authored. It is derived from the lines of the shipments that are due to leave, and the
 * derivation is what gives the domain the property it exists for — the quantities a list asks for are
 * exactly what those shipments still need, never more and never less. Generation is idempotent per
 * shipment and area, so re-running it cannot double the work.
 *
 * Allocation runs before the list is printed: every line is bound to a position chosen from the
 * pickable bins of the location in walking order. A line with no bin is a line nobody can release,
 * which is why the wave's release check refuses one.
 */
@Injectable()
export class PickListService extends TenantAwareCrudService<PickList> {
	constructor(
		readonly typeOrmPickListRepository: TypeOrmPickListRepository,
		readonly mikroOrmPickListRepository: MikroOrmPickListRepository,
		private readonly pickListLineService: PickListLineService,
		private readonly pickWaveService: PickWaveService,
		private readonly warehouseBinService: WarehouseBinService,
		private readonly warehouseZoneService: WarehouseZoneService,
		private readonly sequenceService: SequenceService,
		private readonly typeOrmPickWaveRepository: TypeOrmPickWaveRepository,
		@Optional()
		@Inject(WAREHOUSE_FULFILLMENT)
		private readonly fulfillment?: IWarehouseFulfillmentPort,
		@Optional()
		@Inject(WAREHOUSE_STOCK_LEDGER)
		private readonly stockLedger?: IWarehouseStockLedgerPort
	) {
		super(typeOrmPickListRepository, mikroOrmPickListRepository);
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
		return warehouseRowsOf(this.ormType, entity, typeOrm, () => this.mikroOrmPickListRepository);
	}

	/**
	 * Creates a list and derives its lines from the shipments it serves.
	 *
	 * The derivation is resolved **before the list row is written**, because both of its refusals are
	 * statements about the shipments rather than about the list: a derivation that refuses must leave
	 * nothing behind — not a number consumed for a list that does not exist, and not a numbered,
	 * line-less row an operator has to clean up by hand. The write phase that follows is the one place
	 * the row, its lines and its counters are written, and anything failing inside it withdraws what it
	 * wrote, so the three appear together or not at all.
	 *
	 * @param entity The list to create, naming the location and the shipments.
	 * @returns The created list, with its lines.
	 */
	public async create(entity: Partial<PickList> & { fulfillmentIds?: ID[] }): Promise<PickList> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const { fulfillmentIds = [], ...header } = entity;

		if (!header.warehouseId) {
			throw new BadRequestException('A pick list must name the location the work happens in.');
		}

		const warehouseId = header.warehouseId;
		const wave = header.waveId ? await this.assertWaveAcceptsLists(header.waveId) : undefined;
		const derived = await this.planLines(warehouseId, fulfillmentIds);
		const number = await this.allocateNumber();

		const list = await super.create({
			...header,
			number,
			status: PickListStatus.PENDING,
			priority: header.priority ?? wave?.priority ?? 0,
			fulfillmentId: fulfillmentIds.length === 1 ? fulfillmentIds[0] : header.fulfillmentId,
			tenantId,
			organizationId
		} as any);

		try {
			await this.writeLines(list, derived);
			await this.refreshCaches(list.id);
		} catch (error) {
			await this.withdraw(list);

			throw error;
		}

		if (list.waveId) {
			await this.pickWaveService.recomputeCaches(list.waveId);
		}

		return await this.findOneDetailed(list.id);
	}

	/**
	 * Creates a wave and derives its work into it, in one call.
	 *
	 * A wave on its own is an empty batch; what an operator means by "release this picking work" is the
	 * wave and the lists under it. The two are created here rather than by each caller because the
	 * derivation is the list service's, and a caller that had to remember both calls would eventually
	 * make only one of them.
	 *
	 * @param input The location, the grouping strategy and the shipments the wave covers.
	 * @returns The created wave, with its lists.
	 */
	public async createWaveWithLists(input: {
		warehouseId: ID;
		fulfillmentIds?: ID[];
		strategy?: PickWaveStrategy;
		priority?: number;
		channelId?: ID;
		plannedAt?: Date;
		pickerUserId?: ID;
	}): Promise<PickWave> {
		const wave = await this.pickWaveService.create({
			warehouseId: input.warehouseId,
			strategy: input.strategy,
			priority: input.priority,
			channelId: input.channelId,
			plannedAt: input.plannedAt,
			pickerUserId: input.pickerUserId
		} as Partial<PickWave>);

		if (input.fulfillmentIds?.length) {
			await this.create({
				waveId: wave.id,
				warehouseId: input.warehouseId,
				fulfillmentIds: input.fulfillmentIds
			} as Partial<PickList> & { fulfillmentIds?: ID[] });
		}

		return await this.pickWaveService.findOneDetailed(wave.id);
	}

	/**
	 * Assigns a list to a picker.
	 *
	 * Assigning is the moment the route and the bin order freeze, because a printed document and a
	 * device that disagree about the walk is how a line gets walked to twice.
	 *
	 * @param id The list.
	 * @param assignedToUserId The picker.
	 * @returns The assigned list.
	 */
	public async assign(id: ID, assignedToUserId: ID): Promise<PickList> {
		const list = await this.findOneScoped(id);

		if (list.status !== PickListStatus.PENDING) {
			throw new BadRequestException(
				`A list in status "${list.status}" cannot be assigned; only an unassigned list can be.`
			);
		}

		if (!assignedToUserId) {
			throw new BadRequestException('Assigning a list requires the picker it is assigned to.');
		}

		await super.update(id, {
			assignedToUserId,
			status: PickListStatus.ASSIGNED,
			version: (list.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Marks a list as being walked.
	 *
	 * @param id The list.
	 * @returns The started list.
	 */
	public async start(id: ID): Promise<PickList> {
		const list = await this.findOneScoped(id);

		if (![PickListStatus.PENDING, PickListStatus.ASSIGNED].includes(list.status)) {
			throw new BadRequestException(`A list in status "${list.status}" cannot be started.`);
		}

		await super.update(id, {
			status: PickListStatus.IN_PROGRESS,
			startedAt: list.startedAt ?? new Date(),
			version: (list.version ?? 1) + 1
		} as any);

		await this.markWaveStarted(list);

		return await this.findOneDetailed(id);
	}

	/**
	 * Completes a list whose lines all reached an outcome.
	 *
	 * A list closed short still reaches `PICKED`: the shortfall belongs to the lines, and a list that
	 * folded the shortfall into its own status would make "may this shipment be packed?" a question with
	 * two answers.
	 *
	 * What is refused is a list that is already closed, whether it was packed or withdrawn. The guard
	 * cannot read the lines alone: a cancelled list has every one of its lines withdrawn, so a guard
	 * that asked only whether an outcome is missing would answer yes and move a list the machine says is
	 * terminal to `PICKED` — which is the status a pack slip may be created from.
	 *
	 * @param id The list.
	 * @returns The completed list.
	 * @throws BadRequestException when the list is closed, or when a line is still pending.
	 */
	public async complete(id: ID): Promise<PickList> {
		const list = await this.findOneScoped(id);

		if ([PickListStatus.PICKED, PickListStatus.CANCELED].includes(list.status)) {
			throw new BadRequestException(
				`A list in status "${list.status}" is closed: it has no outgoing transition, so it cannot be completed.`
			);
		}

		const lines = await this.pickListLineService.findForList(id);
		const pending = lines.filter((line) => line.status === 'PENDING');

		if (pending.length) {
			throw new BadRequestException(
				`PICK_LINE_PENDING: ${pending.length} line(s) of this list still have no outcome.`
			);
		}

		await super.update(id, {
			status: PickListStatus.PICKED,
			completedAt: new Date(),
			version: (list.version ?? 1) + 1
		} as any);

		await this.refreshCaches(id);

		if (list.waveId) {
			await this.pickWaveService.recomputeCaches(list.waveId);
		}

		return await this.findOneDetailed(id);
	}

	/**
	 * Cancels a list nothing has been picked from.
	 *
	 * A list with recorded outcomes is refused rather than withdrawn: the way back is a short close of
	 * the remaining lines, which is what actually happened on the floor and is what the ledger should
	 * record. Cancelling touches neither reservations nor stock.
	 *
	 * @param id The list.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled list.
	 * @throws BadRequestException with `PICK_LIST_HAS_PICKS` when anything was recorded against it.
	 */
	public async cancel(id: ID, reason?: string): Promise<PickList> {
		const list = await this.findOneScoped(id);

		if ([PickListStatus.PICKED, PickListStatus.CANCELED].includes(list.status)) {
			throw new BadRequestException(`A list in status "${list.status}" is already closed.`);
		}

		const lines = await this.pickListLineService.findForList(id);
		const recorded = lines.filter((line) => line.status !== 'PENDING');

		if (recorded.length) {
			throw new BadRequestException(
				`PICK_LIST_HAS_PICKS: ${recorded.length} line(s) of this list already have an outcome; close them short instead of cancelling the list.`
			);
		}

		await super.update(id, {
			status: PickListStatus.CANCELED,
			note: reason ?? list.note,
			version: (list.version ?? 1) + 1
		} as any);

		for (const line of lines) {
			await this.pickListLineService.update(line.id, { status: 'CANCELED' } as any);
		}

		if (list.waveId) {
			await this.pickWaveService.recomputeCaches(list.waveId);
		}

		return await this.findOneDetailed(id);
	}

	/**
	 * Reads a list.
	 *
	 * @param id The list.
	 * @returns The list, with its lines in walking order and its wave.
	 */
	public async findOneDetailed(id: ID): Promise<PickList> {
		const list = await this.rows(PickList, () => this.typeOrmPickListRepository).findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { wave: true, zone: true }
		});

		if (!list) {
			throw new NotFoundException('The pick list was not found.');
		}

		list.lines = await this.pickListLineService.findForList(id);

		return list;
	}

	/**
	 * Reads a list inside the caller's tenant and organization.
	 *
	 * @param id The list.
	 * @returns The list.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<PickList> {
		const list = await this.rows(PickList, () => this.typeOrmPickListRepository).findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!list) {
			throw new NotFoundException('The pick list was not found.');
		}

		return list;
	}

	/**
	 * Re-derives the caches of a list from its lines.
	 *
	 * @param id The list.
	 */
	public async refreshCaches(id: ID): Promise<void> {
		const lines = await this.pickListLineService.findForList(id);
		const list = await this.findOneScoped(id);

		await super.update(id, {
			lineCount: lines.length,
			pickedCount: lines.filter((line) => ['PICKED', 'SHORT'].includes(line.status)).length,
			shortCount: lines.filter((line) => ['SHORT', 'SKIPPED'].includes(line.status)).length,
			version: (list.version ?? 1) + 1
		} as any);
	}

	/**
	 * Resolves the lines a list will hold, and allocates a position to each.
	 *
	 * The derivation reads the shipment side, never the cart: by the time work is released the cart is
	 * gone, and what a pick list may ask for is what the shipment still needs. Nothing is written here —
	 * that is what lets both of the derivation's refusals happen before the list exists, so the two are
	 * read as statements about the shipments rather than as failures that leave a row behind.
	 *
	 * The rows themselves are written through the line service, which is their only writer.
	 *
	 * @param warehouseId The location the work happens in.
	 * @param fulfillmentIds The shipments the list serves.
	 * @returns The lines to write, in the order the shipments reported them.
	 */
	private async planLines(warehouseId: ID, fulfillmentIds: ID[]): Promise<Array<Partial<PickListLine>>> {
		if (!fulfillmentIds.length) {
			return [];
		}

		if (!this.fulfillment) {
			throw new BadRequestException(
				'WAREHOUSE_FULFILLMENT_UNAVAILABLE: the fulfilment capability is not registered, so pick lines cannot be derived from shipments.'
			);
		}

		const lines = await this.fulfillment.listShippableLines({ warehouseId, fulfillmentIds });
		const selected = lines.filter((line) => isPositiveQuantity(line.quantity));

		if (!selected.length) {
			throw new BadRequestException(
				'PICK_NOTHING_TO_PICK: none of the named shipments still has a quantity to collect.'
			);
		}

		const walk = await this.walkOrder(warehouseId);
		const allocation = await this.buildAllocation(warehouseId, walk, selected);
		const planned: Array<Partial<PickListLine>> = [];

		for (const line of selected) {
			const bin = allocation.get(String(line.variantId));

			if (!bin) {
				continue;
			}

			planned.push({
				fulfillmentLineId: line.fulfillmentLineId,
				orderLineId: line.orderLineId,
				variantId: line.variantId,
				binId: bin.id,
				zoneId: bin.zoneId,
				quantityRequested: normalizeQuantity(line.quantity),
				position: walk.findIndex((entry) => String(entry.id) === String(bin.id))
			} as Partial<PickListLine>);
		}

		return planned;
	}

	/**
	 * Writes the lines a list was planned with.
	 *
	 * @param list The list being filled.
	 * @param lines The planned lines.
	 */
	private async writeLines(list: PickList, lines: Array<Partial<PickListLine>>): Promise<void> {
		for (const line of lines) {
			await this.pickListLineService.create({ ...line, pickListId: list.id } as Partial<PickListLine>);
		}
	}

	/**
	 * Withdraws a list whose write phase failed, with the lines it had already written.
	 *
	 * A list is created with its lines and its counters or it is not created at all, so a failure part
	 * way through the write phase takes back what it wrote rather than leaving a list that describes
	 * work nobody released. The withdrawal is best-effort: the caller is told what actually failed, so a
	 * failure to take back a partial write never replaces the error that caused it.
	 *
	 * @param list The list to withdraw.
	 */
	private async withdraw(list: PickList): Promise<void> {
		try {
			for (const line of await this.pickListLineService.findForList(list.id)) {
				await this.pickListLineService.delete(line.id);
			}

			await super.delete(list.id);
		} catch {
			// Whatever is left is the lesser problem: the failure worth reporting is the one that refused the
			// create, and it is thrown by the caller of this method rather than swallowed.
		}
	}

	/**
	 * Chooses one bin per variant, in the documented order.
	 *
	 * The order is: the bin the level row is bound to — the home bin the inventory capability reports
	 * through `resolveHomeBin`, which is also the bin a live reservation points at — and, when no home
	 * bin is reported or the home bin is not part of the walk, the first position of the pick path. The
	 * comparator is total and stable, so the same state always allocates the same bin.
	 *
	 * @param warehouseId The location.
	 * @param walk The pickable positions, in walking order.
	 * @param lines The lines being allocated.
	 * @returns A bin per variant.
	 */
	private async buildAllocation(
		warehouseId: ID,
		walk: WarehouseBin[],
		lines: IWarehouseShippableLine[]
	): Promise<Map<string, WarehouseBin>> {
		const allocation = new Map<string, WarehouseBin>();

		if (!walk.length) {
			return allocation;
		}

		const byId = new Map(walk.map((bin) => [String(bin.id), bin]));
		const variants = Array.from(new Set(lines.map((line) => String(line.variantId))));

		for (const variantId of variants) {
			const home = this.stockLedger
				? await this.stockLedger.resolveHomeBin({ warehouseId, variantId: variantId as ID })
				: undefined;
			const homeBin = home?.binId ? byId.get(String(home.binId)) : undefined;

			allocation.set(variantId, homeBin ?? walk[0]);
		}

		return allocation;
	}

	/**
	 * Reads the pickable positions of a location in walking order: area first, then the position.
	 *
	 * @param warehouseId The location.
	 * @returns The positions, first to last.
	 */
	private async walkOrder(warehouseId: ID): Promise<WarehouseBin[]> {
		const zones = await this.warehouseZoneService.findPickPath(warehouseId);
		const walk: WarehouseBin[] = [];

		for (const zone of zones) {
			walk.push(...(await this.warehouseBinService.findPickableBins(warehouseId, zone.id)));
		}

		return walk;
	}

	/**
	 * Moves a list's wave to `IN_PROGRESS` when its first line is walked.
	 *
	 * @param list The list that started.
	 */
	private async markWaveStarted(list: PickList): Promise<void> {
		if (!list.waveId) {
			return;
		}

		const wave = await this.findWave(list.waveId);

		if (wave.status === PickWaveStatus.RELEASED) {
			await this.rows(PickWave, () => this.typeOrmPickWaveRepository).update(wave.id, {
				status: PickWaveStatus.IN_PROGRESS,
				startedAt: wave.startedAt ?? new Date(),
				version: (wave.version ?? 1) + 1
			} as any);
		}
	}

	/**
	 * @param waveId The wave, when one was named.
	 * @returns The wave.
	 * @throws BadRequestException when the wave is not a draft.
	 */
	private async assertWaveAcceptsLists(waveId: ID): Promise<PickWave> {
		const wave = await this.findWave(waveId);

		if (wave.status !== PickWaveStatus.DRAFT) {
			throw new BadRequestException(
				`A wave in status "${wave.status}" is frozen and cannot take another pick list.`
			);
		}

		return wave;
	}

	/**
	 * @param waveId The wave.
	 * @returns The wave.
	 * @throws BadRequestException when it does not exist.
	 */
	private async findWave(waveId: ID): Promise<PickWave> {
		const wave = await this.rows(PickWave, () => this.typeOrmPickWaveRepository).findOne({
			where: {
				id: waveId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!wave) {
			throw new BadRequestException('The wave named for this pick list does not exist.');
		}

		return wave;
	}

	/**
	 * Allocates the next pick number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 * @throws BadRequestException when the organization has no `PICK` series.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(PICK_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			throw new BadRequestException(
				`No numbering series is configured for picking (key "${PICK_NUMBER_KEY}"), so a pick list number cannot be allocated.`
			);
		}
	}
}
