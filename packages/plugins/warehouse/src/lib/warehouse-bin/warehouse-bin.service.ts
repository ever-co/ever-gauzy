import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, In, Repository } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import {
	commitVersionedUpdate,
	prepareSQLQuery,
	RequestContext,
	TenantAwareCrudService,
	toPositionalStatement,
	versionExpectationOf,
	Warehouse
} from '@gauzy/core';
import { WarehouseZone } from '../warehouse-zone/warehouse-zone.entity';
import { TypeOrmWarehouseZoneRepository } from '../warehouse-zone/repository/type-orm-warehouse-zone.repository';
import {
	IBinReconciliationLine,
	IBinReconciliationReport,
	IWarehouseBinBalance,
	IWarehouseBinCapacityCheck,
	IWarehouseBinRangeInput,
	IWarehousePutAwayResult,
	IWarehouseStockLedgerPort,
	WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED,
	WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED,
	WAREHOUSE_STOCK_LEDGER,
	WarehouseBinType,
	WarehouseZoneType
} from '../warehouse.types';
import {
	QUANTITY_SCALE,
	addQuantities,
	fromQuantityUnits,
	isGreaterThan,
	isNegativeQuantity,
	isPositiveQuantity,
	isSameQuantity,
	normalizeQuantity,
	subtractQuantities,
	sumQuantities,
	toQuantityUnits
} from '../warehouse.quantity';
import { WarehouseBin } from './warehouse-bin.entity';
import { MikroOrmWarehouseBinRepository } from './repository/mikro-orm-warehouse-bin.repository';
import { TypeOrmWarehouseBinRepository } from './repository/type-orm-warehouse-bin.repository';

/** How deep the bin hierarchy may go, counting the root as level one. */
const MAX_BIN_DEPTH = 5;

/**
 * The provenance every correction a reconciliation writes carries.
 *
 * A relocation a count asked for is told apart from a manual bin move and from a replenishment by
 * these two fields alone, which is what makes the nightly run's footprint auditable in a ledger that
 * is otherwise append-only history.
 */
const RECONCILIATION_REFERENCE_TYPE = 'RECONCILIATION';
const RECONCILIATION_REASON = 'RECONCILIATION';

/** The key a bin caches its derived balances under, and the key the instant they were read at. */
const BIN_BALANCES_KEY = 'balances';
const BIN_BALANCE_UPDATED_AT_KEY = 'balanceUpdatedAt';

/**
 * The version a request accepted, as the kernel states it.
 *
 * `versionExpectationOf` answers with the kernel's own shape; the two members are restated here
 * because that interface is not part of this package's public surface and these writes read nothing
 * else from it — whether the caller accepted any existing version, and which versions it named.
 */
type TVersionExpectation = { wildcard: boolean; versions: number[] };

/**
 * Any version the row currently holds.
 *
 * A caller that stated no precondition has no decision for a version to protect, so the write is
 * predicated on the version this service read a moment earlier rather than on nothing at all. That
 * is still a conditional write: a concurrent editor that moved the row between the read and the
 * statement is refused instead of overwritten, which is the whole difference from the unpredicated
 * `UPDATE … WHERE id = ?` these three writes used to issue.
 */
const ANY_VERSION: TVersionExpectation = { wildcard: true, versions: [] };

/**
 * The version the current request accepted, when it accepted one.
 *
 * A versioned route leaves what the caller stated on the request, and the write reads it from there
 * rather than parsing the header again, so the value the guard validated is the value the `UPDATE`
 * is predicated on. A request that carries none — a route that did not opt in, a worker, a seed —
 * states no precondition. `versionExpectationOf` is the kernel's reader and refuses a request that
 * states nothing, which is exactly the case this treats as "the caller accepted no version".
 *
 * @returns The accepted version, or undefined when the caller accepted none.
 */
function acceptedVersionExpectation(): TVersionExpectation | undefined {
	const request = RequestContext.currentRequest();

	if (!request) {
		return undefined;
	}

	try {
		return versionExpectationOf(request) as TVersionExpectation;
	} catch {
		return undefined;
	}
}

/**
 * The positions inside a location: the tree, the closure it is walked through, and the count that
 * keeps the two honest.
 *
 * A bin tree is what turns "where is it?" into an address a person can walk to, and the closure table
 * is what makes "everything under rack B" one indexed join instead of a recursive query. The service
 * owns both halves of that: it validates the tree (a bin is never its own ancestor, a re-parent stays
 * inside the zone, the hierarchy is bounded) and it maintains the closure rows **in the same
 * transaction as the bin write**, so the tree and its closure can never disagree — a closure that lags
 * one write behind reports stock under the wrong rack, and nothing would say so.
 *
 * The count is the other half. A bin's balance is derived from the movement ledger and is never stored
 * here, so reconciliation compares the location's total — every bin plus the units the ledger holds
 * with no bin — against the quantity of the level row that declares where the variant is kept
 * (INV-23), and **corrects placement with a relocation pair stated to the inventory capability**.
 * This service never moves a quantity itself and never adjusts a level: a relocation is level-neutral
 * by construction, and two writers of one level is how a level drifts.
 *
 * The capacity is the third. `capacityUnits` is a quantity *in a stated unit*, so this service refuses
 * a write that declares one without the other, converts a request into the capacity's own unit exactly
 * before comparing, and reports the bins whose capacity predates the unit column rather than guessing
 * what their operator meant.
 */
@Injectable()
export class WarehouseBinService extends TenantAwareCrudService<WarehouseBin> {
	constructor(
		readonly typeOrmWarehouseBinRepository: TypeOrmWarehouseBinRepository,
		readonly mikroOrmWarehouseBinRepository: MikroOrmWarehouseBinRepository,
		private readonly typeOrmWarehouseZoneRepository: TypeOrmWarehouseZoneRepository,
		@Optional()
		@Inject(WAREHOUSE_STOCK_LEDGER)
		private readonly stockLedger?: IWarehouseStockLedgerPort,
		// The location row is the kernel's, and this package only ever reads its `metadata` — the
		// settings a count obeys (`requireFullPlacement`, `defaultBinId`) and nothing else. It is
		// optional so the service still runs where the kernel's own entity is not registered.
		@Optional()
		@InjectRepository(Warehouse)
		private readonly typeOrmWarehouseRepository?: Repository<Warehouse>
	) {
		super(typeOrmWarehouseBinRepository, mikroOrmWarehouseBinRepository);
	}

	/**
	 * Creates a bin, and the closure rows that place it in the tree.
	 *
	 * @param entity The bin to create.
	 * @returns The created bin.
	 */
	public async create(entity: Partial<WarehouseBin>): Promise<WarehouseBin> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const { warehouseId, code } = entity;

		if (!warehouseId) {
			throw new BadRequestException('A bin must name the location it belongs to.');
		}

		if (!code) {
			throw new BadRequestException('A bin must carry a code.');
		}

		await this.assertCodeIsFree(warehouseId, code);
		await this.assertZoneBelongsToLocation(warehouseId, entity.zoneId);
		await this.assertParentIsUsable(warehouseId, entity.zoneId, entity.parentId, undefined);
		this.assertCapacityCarriesItsUnit(entity.capacityUnits, entity.capacityUnitId, true);

		const bin = await super.create({
			...entity,
			type: entity.type ?? WarehouseBinType.SHELF,
			isPickable: entity.isPickable ?? true,
			isBlocked: entity.isBlocked ?? false,
			sortOrder: entity.sortOrder ?? 0,
			version: 1,
			capacityUnits: entity.capacityUnits ? normalizeQuantity(entity.capacityUnits) : undefined,
			capacityUnitId: entity.capacityUnitId ?? undefined,
			maxWeight: entity.maxWeight ? normalizeQuantity(entity.maxWeight) : undefined,
			maxWeightUnitId: entity.maxWeightUnitId ?? undefined,
			maxVolume: entity.maxVolume ? normalizeQuantity(entity.maxVolume) : undefined,
			maxVolumeUnitId: entity.maxVolumeUnitId ?? undefined,
			tenantId,
			organizationId
		} as any);

		await this.linkIntoClosure(bin.id, bin.parentId);

		return bin;
	}

	/**
	 * Creates a consecutive range of bins in one call.
	 *
	 * A building grows by rack and by level, not one position at a time. The generated codes increment
	 * the trailing number of the first code and keep the width it was written with, so `A-01-09` is
	 * followed by `A-01-10` and the codes still sort the way the aisle is walked.
	 *
	 * @param input The range to create.
	 * @returns The created bins.
	 * @throws BadRequestException when the first code carries no number to increment.
	 */
	public async createRange(input: IWarehouseBinRangeInput): Promise<WarehouseBin[]> {
		if (!Number.isInteger(input.count) || input.count < 1) {
			throw new BadRequestException('A bin range must create at least one bin.');
		}

		const match = /^(.*?)(\d+)$/.exec(input.from ?? '');

		if (!match) {
			throw new BadRequestException(
				`The code "${input.from}" carries no number to continue from, so a range cannot be generated.`
			);
		}

		const [, prefix, digits] = match;
		const start = Number.parseInt(digits, 10);
		const bins: WarehouseBin[] = [];

		for (let index = 0; index < input.count; index++) {
			const code = `${prefix}${String(start + index).padStart(digits.length, '0')}`;

			bins.push(
				await this.create({
					warehouseId: input.warehouseId,
					zoneId: input.zoneId,
					parentId: input.parentId,
					code,
					type: input.type ?? WarehouseBinType.SHELF,
					isPickable: input.isPickable ?? true,
					sortOrder: (input.sortOrder ?? 0) + index
				} as any)
			);
		}

		return bins;
	}

	/**
	 * Updates a bin.
	 *
	 * The location and the zone are immutable: a bin that changed zone would silently re-address every
	 * historical pick that named it, and moving physical shelving is modelled by deactivating the old
	 * position and creating a new one.
	 *
	 * The write is the platform's conditional one. It used to be a read followed by
	 * `super.update(id, { …, version: bin.version + 1 })` — an `UPDATE … WHERE id = ?` with the next
	 * version computed in application code and no predicate at all — so two operators holding the same
	 * reading of a position both wrote, both claimed the version they had computed, and the first
	 * change was erased with nobody told. `commitVersionedUpdate` predicates the statement on the
	 * version this method read and increments it in the same statement, so the second write matches no
	 * row and is answered with a conflict.
	 *
	 * @param id The bin to update.
	 * @param entity The fields to change. A `version` carried in the body is not written: the
	 * statement's own predicate is the only writer of that column.
	 * @returns The updated bin.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the position moved past the version this
	 * update was computed from.
	 */
	public async update(id: ID, entity: Partial<WarehouseBin>): Promise<WarehouseBin> {
		const bin = await this.findOneScoped(id);

		if (entity.warehouseId && String(entity.warehouseId) !== String(bin.warehouseId)) {
			throw new BadRequestException('BIN_LOCATION_IMMUTABLE: a bin cannot be moved to another location.');
		}

		if (entity.zoneId !== undefined && String(entity.zoneId ?? '') !== String(bin.zoneId ?? '')) {
			throw new BadRequestException('BIN_LOCATION_IMMUTABLE: a bin cannot be moved to another zone.');
		}

		if (entity.code && entity.code !== bin.code) {
			await this.assertCodeIsFree(bin.warehouseId, entity.code);
			await this.assertCodeIsNotPrinted(id);
		}

		// The capacity's unit is checked on the row as it would stand, but only when the caller touched
		// one of the two: a bin whose capacity predates the unit column stays editable for every other
		// reason, and declaring its unit is what the capacity job asks its operator to do.
		const statesCapacity =
			entity.capacityUnits !== undefined || entity.capacityUnitId !== undefined;

		if (statesCapacity) {
			this.assertCapacityCarriesItsUnit(
				entity.capacityUnits !== undefined ? entity.capacityUnits : bin.capacityUnits,
				entity.capacityUnitId !== undefined ? entity.capacityUnitId : bin.capacityUnitId,
				true
			);
		}

		// The version a caller put in the body is a precondition it states, never a column it writes:
		// keeping it out of the patch is what stops a payload from moving the row past the version the
		// statement below is predicated on.
		const changes: Record<string, unknown> = { ...(entity as Record<string, unknown>) };

		delete changes.version;

		await this.commitBinUpdate(bin, {
			...changes,
			warehouseId: bin.warehouseId,
			zoneId: bin.zoneId,
			parentId: bin.parentId
		});

		return await this.findOneScoped(id);
	}

	/**
	 * Measures a request against a bin's declared capacity.
	 *
	 * This is the method the measurement model exists for. A capacity is a quantity in a stated unit, so
	 * a request entered in another unit is converted through the factor the caller supplies — the
	 * conversion happens once, here, at the boundary where a document quantity meets a level — and only
	 * then compared. The answer is a **warning**: exceeding a planning limit is something a real
	 * warehouse does, and the record has to be able to say so rather than refuse the put-away.
	 *
	 * A bin that declares a capacity without a unit is reported with
	 * `WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED` and nothing is converted, because converting into an
	 * undeclared unit would be a guess dressed as a measurement.
	 *
	 * @param input The bin, the requested quantity and — when the request is in another unit — the unit
	 * it was entered in and that unit's factor against the capacity's unit.
	 * @returns The comparison, exact, with the notices a caller acts on.
	 */
	public async checkCapacity(input: {
		binId: ID;
		quantity: DecimalString | number;
		unitId?: ID;
		conversionFactor?: DecimalString | number;
	}): Promise<IWarehouseBinCapacityCheck> {
		const bin = await this.findOneScoped(input.binId);
		const requestedQuantity = normalizeQuantity(input.quantity);
		const notices: string[] = [];

		if (bin.capacityUnits == null) {
			return {
				binId: bin.id,
				capacityUnitId: bin.capacityUnitId,
				requestedQuantity,
				requestedUnitId: input.unitId,
				exceeded: false,
				notices
			};
		}

		if (!bin.capacityUnitId) {
			notices.push(WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED);

			return {
				binId: bin.id,
				capacityUnits: normalizeQuantity(bin.capacityUnits),
				requestedQuantity,
				requestedUnitId: input.unitId,
				exceeded: false,
				notices
			};
		}

		const converted = normalizeQuantity(
			this.convertQuantity(requestedQuantity, input.conversionFactor ?? '1')
		);
		const remaining = subtractQuantities(bin.capacityUnits, converted);
		const exceeded = isGreaterThan(converted, bin.capacityUnits);

		if (exceeded) {
			notices.push('WAREHOUSE_BIN_CAPACITY_EXCEEDED');
		}

		return {
			binId: bin.id,
			capacityUnitId: bin.capacityUnitId,
			capacityUnits: normalizeQuantity(bin.capacityUnits),
			requestedQuantity,
			requestedUnitId: input.unitId,
			requestedInCapacityUnit: converted,
			remainingQuantity: remaining,
			exceeded,
			notices
		};
	}

	/**
	 * Lists the bins whose capacity is declared without the unit it is counted in.
	 *
	 * This is the "ask the tenant" half of the revision. Every bin that already carried a capacity was
	 * conceived in whatever unit its operator had in mind, and no migration can recover which one —
	 * defaulting to pieces would silently redefine a pallet position's capacity of `1` as one item. The
	 * report names them so an operator declares the unit, and the pallet positions are named first
	 * because they are the ones whose handling unit makes the ambiguity operational rather than
	 * theoretical.
	 *
	 * @param warehouseId The location, when the caller wants one location only.
	 * @returns One entry per bin with an undeclared capacity unit, pallet positions first.
	 */
	public async capacityWarnings(warehouseId?: ID): Promise<
		Array<{ binId: ID; code: string; warehouseId: ID; type: WarehouseBinType; capacityUnits: DecimalString; notice: string }>
	> {
		const bins = await this.typeOrmWarehouseBinRepository.find({
			where: {
				...(warehouseId ? { warehouseId } : {}),
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		return bins
			.filter((bin) => bin.capacityUnits != null && !bin.capacityUnitId)
			.sort((left, right) => {
				const leftPallet = left.type === WarehouseBinType.PALLET ? 0 : 1;
				const rightPallet = right.type === WarehouseBinType.PALLET ? 0 : 1;

				return leftPallet !== rightPallet ? leftPallet - rightPallet : left.code.localeCompare(right.code);
			})
			.map((bin) => ({
				binId: bin.id,
				code: bin.code,
				warehouseId: bin.warehouseId as ID,
				type: bin.type,
				capacityUnits: normalizeQuantity(bin.capacityUnits),
				notice: WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED
			}));
	}

	/**
	 * Converts a quantity into another unit through a factor, exactly.
	 *
	 * `factor` is how many of the target unit one of the source unit is — the same orientation
	 * `unit.factor` carries — so the product is taken at twice the quantity scale and quantised back to
	 * it once, half away from zero. Nothing here is a floating-point number: a capacity comparison that
	 * drifts at the sixth decimal is a comparison that answers the wrong question at exactly the
	 * boundary where the answer matters.
	 *
	 * @param quantity The quantity to convert.
	 * @param factor How many target units one source unit is.
	 * @returns The converted quantity, at the storage scale.
	 */
	private convertQuantity(quantity: DecimalString | number, factor: DecimalString | number): DecimalString {
		const units = toQuantityUnits(quantity);
		const factorUnits = toQuantityUnits(factor);
		const divisor = 10n ** BigInt(QUANTITY_SCALE);
		const product = units * factorUnits;
		const negative = product < 0n;
		const magnitude = negative ? -product : product;
		const quantised = (magnitude + divisor / 2n) / divisor;

		return fromQuantityUnits(negative ? -quantised : quantised);
	}

	/**
	 * @param capacityUnits The declared capacity, as it would stand.
	 * @param capacityUnitId The unit it is counted in, as it would stand.
	 * @param stated Whether the write states the capacity at all; a legacy row edited for another
	 * reason is left to the capacity job rather than refused.
	 * @throws BadRequestException when a capacity is declared without the unit it is counted in.
	 */
	private assertCapacityCarriesItsUnit(
		capacityUnits: DecimalString | number | null | undefined,
		capacityUnitId: ID | undefined,
		stated: boolean
	): void {
		if (!stated || capacityUnits == null || capacityUnits === '') {
			return;
		}

		if (!capacityUnitId) {
			throw new BadRequestException(
				`${WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED}: a capacity is a quantity in a stated unit, so a bin that declares ` +
					'one must declare the unit it is counted in — otherwise a request in pieces and a capacity in pallets ' +
					'are compared as though they were the same number.'
			);
		}
	}

	/**
	 * Moves a bin and its subtree under another bin of the same zone.
	 *
	 * Three things are refused, and each of them would otherwise corrupt every later descendant query
	 * rather than merely being wrong: a target in another zone, the bin itself, and a target inside the
	 * bin's own subtree.
	 *
	 * @param id The bin to move.
	 * @param parentId The new parent, or null to make the bin a root.
	 * @returns The moved bin.
	 * @throws BadRequestException with `BIN_HIERARCHY_CYCLE` when the move would create a cycle.
	 */
	public async reparent(id: ID, parentId?: ID | null): Promise<WarehouseBin> {
		const bin = await this.findOneScoped(id);

		if (parentId) {
			if (String(parentId) === String(id)) {
				throw new BadRequestException('BIN_HIERARCHY_CYCLE: a bin cannot be its own parent.');
			}

			const parent = await this.findOneScoped(parentId);

			if (String(parent.zoneId ?? '') !== String(bin.zoneId ?? '')) {
				throw new BadRequestException(
					'BIN_HIERARCHY_CYCLE: a bin may only be moved under another bin of its own zone.'
				);
			}

			const descendants = await this.descendantIds(id);

			if (descendants.some((descendantId) => String(descendantId) === String(parentId))) {
				throw new BadRequestException(
					'BIN_HIERARCHY_CYCLE: the target bin is inside the subtree being moved, so the move would create a cycle.'
				);
			}

			if ((await this.depthOf(parentId)) + (await this.subtreeHeight(id)) > MAX_BIN_DEPTH - 1) {
				throw new BadRequestException(
					`BIN_HIERARCHY_TOO_DEEP: the hierarchy may not exceed ${MAX_BIN_DEPTH} levels.`
				);
			}
		}

		await this.commitBinUpdate(bin, { parentId: parentId ?? null });

		await this.relinkClosure(id, parentId ?? undefined);

		return await this.findOneScoped(id);
	}

	/**
	 * Takes a bin out of service, or puts it back.
	 *
	 * Blocking is how a position is taken out of rotation without pretending the units in it are gone:
	 * the allocator skips it, the stock stays where it physically is, and the count job reports the
	 * difference.
	 *
	 * @param id The bin.
	 * @param isBlocked Whether the position is out of service.
	 * @returns The bin.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the position moved past the version this
	 * write was computed from — a rename that landed between the read and this statement is not a
	 * change a block may erase.
	 */
	public async setBlocked(id: ID, isBlocked: boolean): Promise<WarehouseBin> {
		const bin = await this.findOneScoped(id);

		await this.commitBinUpdate(bin, { isBlocked });

		return await this.findOneScoped(id);
	}

	/**
	 * Deletes a bin that is empty and holds no children.
	 *
	 * The check is the point of the method: the foreign key from a pick line is `SET NULL`, so deleting
	 * a bin that holds stock would silently erase where the stock was picked from, and deleting one
	 * that still has children would leave them parented to nothing.
	 *
	 * @param id The bin to delete.
	 * @returns The delete result.
	 */
	public async delete(id: ID): Promise<DeleteResult> {
		const bin = await this.findOneScoped(id);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const children = await this.typeOrmWarehouseBinRepository.count({
			where: { parentId: bin.id, tenantId, organizationId }
		});

		if (children > 0) {
			throw new BadRequestException(
				`BIN_HAS_CHILDREN: the bin still holds ${children} position(s) under it.`
			);
		}

		const contents = await this.findContents(bin.id);

		if (contents.some((balance) => toQuantityUnits(balance.quantity) !== 0n)) {
			throw new BadRequestException(
				'BIN_HAS_CONTENT: the bin still holds stock; move it or block the bin instead of deleting it.'
			);
		}

		await this.removeFromClosure(bin.id);

		return await super.delete(id);
	}

	/**
	 * Reads a bin.
	 *
	 * @param id The bin to read.
	 * @returns The bin, with its zone and its parent.
	 */
	public async findOneDetailed(id: ID): Promise<WarehouseBin> {
		const bin = await this.typeOrmWarehouseBinRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { zone: true, parent: true, children: true }
		});

		if (!bin) {
			throw new NotFoundException('The bin was not found.');
		}

		return bin;
	}

	/**
	 * Reads a bin inside the caller's tenant and organization.
	 *
	 * @param id The bin to read.
	 * @returns The bin.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<WarehouseBin> {
		const bin = await this.typeOrmWarehouseBinRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!bin) {
			throw new NotFoundException('The bin was not found.');
		}

		return bin;
	}

	/**
	 * Reads the bins of one area, in walking order.
	 *
	 * @param warehouseId The location.
	 * @param zoneId The area, when the caller wants one area only.
	 * @returns The pickable positions, sorted for the walk.
	 */
	public async findPickableBins(warehouseId: ID, zoneId?: ID): Promise<WarehouseBin[]> {
		return await this.typeOrmWarehouseBinRepository.find({
			where: {
				warehouseId,
				...(zoneId ? { zoneId } : {}),
				isPickable: true,
				isBlocked: false,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { sortOrder: 'ASC', code: 'ASC' }
		});
	}

	/**
	 * Reads every bin of one area, in walking order, whether or not it may be picked from.
	 *
	 * @param zoneId The area.
	 * @returns The positions.
	 */
	public async findInZone(zoneId: ID): Promise<WarehouseBin[]> {
		return await this.typeOrmWarehouseBinRepository.find({
			where: {
				zoneId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { sortOrder: 'ASC', code: 'ASC' }
		});
	}

	/**
	 * Reads a whole area's bins as a tree, each node with its children.
	 *
	 * @param warehouseId The location.
	 * @param zoneId The area, when the caller wants one area only.
	 * @returns The roots of the forest, with their subtrees attached.
	 */
	public async findTree(warehouseId: ID, zoneId?: ID): Promise<WarehouseBin[]> {
		const bins = await this.typeOrmWarehouseBinRepository.find({
			where: {
				warehouseId,
				...(zoneId ? { zoneId } : {}),
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { sortOrder: 'ASC', code: 'ASC' }
		});

		const byId = new Map<string, WarehouseBin>();
		const roots: WarehouseBin[] = [];

		for (const bin of bins) {
			bin.children = [];
			byId.set(String(bin.id), bin);
		}

		for (const bin of bins) {
			const parent = bin.parentId ? byId.get(String(bin.parentId)) : undefined;

			if (parent) {
				parent.children.push(bin);
			} else {
				roots.push(bin);
			}
		}

		return roots;
	}

	/**
	 * Reads everything under a bin: its whole subtree, itself included.
	 *
	 * This is the query the closure table exists for — one indexed join instead of a recursive walk.
	 *
	 * @param id The root of the subtree.
	 * @returns The descendants, in walking order.
	 */
	public async findSubtree(id: ID): Promise<WarehouseBin[]> {
		const ids = await this.descendantIds(id);

		if (!ids.length) {
			return [];
		}

		return await this.typeOrmWarehouseBinRepository.find({
			where: {
				id: In(ids),
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { sortOrder: 'ASC', code: 'ASC' }
		});
	}

	/**
	 * Reads the derived contents of a bin.
	 *
	 * The balance is derived from the movement ledger, never stored on the bin, which is why this asks
	 * the capability that owns the ledger rather than summing a column here.
	 *
	 * @param id The bin.
	 * @returns One balance per variant the bin holds.
	 * @throws BadRequestException when no inventory capability is registered.
	 */
	public async findContents(id: ID): Promise<Array<{ variantId: ID; quantity: DecimalString }>> {
		await this.findOneScoped(id);

		if (!this.stockLedger) {
			throw new BadRequestException(
				'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so the contents of a bin cannot be derived.'
			);
		}

		return await this.stockLedger.readBinBalances([id]);
	}

	/**
	 * Names this bin as the bin a variant is kept in at its location.
	 *
	 * The declaration writes **no movement**, because nothing physically moved: it states where the stock
	 * is expected to be, and the column it writes is the level row's own home bin — read by a pick to know
	 * where to send the picker, and by the ledger to answer "where is this normally kept". When the
	 * declaration disagrees with the placement, reconciliation (§14.10) reports it and the operator either
	 * moves the units or re-declares the bin.
	 *
	 * The write goes through the inventory capability rather than through a level this package would have
	 * to map: the level table is not this domain's, and two writers of one level is how a level drifts.
	 *
	 * **A bin of another location may not be declared.** The movement path refuses exactly this — a
	 * movement that names a bin belonging to another location is answered with `BIN_LOCATION_MISMATCH`
	 * before anything is written — but a declaration writes no movement, so it never reached that
	 * guard: the level row of warehouse A could be pointed at a bin standing in warehouse B, the write
	 * succeeded, and a pick generated from that level sent a picker to an address that is not in their
	 * building. Reconciliation could never close it either, because a bin outside the location can
	 * never be in the partition a run over that location walks. The same refusal is therefore made
	 * here, before the capability is asked for anything.
	 *
	 * @param id The bin being named.
	 * @param input The level, or the variant and location, the declaration is about.
	 * @returns Whether the declaration was written — false when the location does not stock the variant.
	 * @throws BadRequestException when neither a level nor a variant and location are stated, when the
	 * bin belongs to another location, or when no inventory capability is registered.
	 */
	public async assignHomeBin(
		id: ID,
		input: { levelId?: ID; variantId?: ID; warehouseId?: ID }
	): Promise<boolean> {
		const bin = await this.findOneScoped(id);

		if (!this.stockLedger) {
			throw new BadRequestException(
				'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so a home bin cannot be declared.'
			);
		}

		if (!input?.variantId || !input?.warehouseId) {
			throw new BadRequestException(
				'A home bin is declared for one variant at one location: state both `variantId` and `warehouseId`.'
			);
		}

		if (String(bin.warehouseId ?? '') !== String(input.warehouseId)) {
			throw new BadRequestException(
				`BIN_LOCATION_MISMATCH: bin ${bin.code} belongs to another location, so it cannot be declared as the home bin of a level at this one.`
			);
		}

		return await this.stockLedger.setHomeBin({
			warehouseId: input.warehouseId,
			variantId: input.variantId,
			binId: bin.id
		});
	}

	/**
	 * Walks received units from the receiving area into this bin.
	 *
	 * The inverse journey of a pick: the units are already at the location, recorded by the receipt, and
	 * this is the movement that says which address they live at. The ledger writes the arrival — and, when
	 * the caller says the units were recorded in the receiving area's own bin, the leg out of it — and
	 * names this bin as the variant's home in the same transaction, so a level never points at a bin the
	 * ledger has not been told about.
	 *
	 * @param id The bin the units are placed into.
	 * @param input The variant, the quantity and where the units are walking from.
	 * @returns What the ledger wrote.
	 * @throws BadRequestException when the bin is blocked, when a member is missing, or when no inventory
	 * capability is registered.
	 */
	public async putAway(
		id: ID,
		input: {
			variantId: ID;
			warehouseId: ID;
			quantity: DecimalString;
			fromBinId?: ID;
			stockMovementId?: ID;
			referenceId?: ID;
			reason?: string;
		}
	): Promise<IWarehousePutAwayResult> {
		const bin = await this.findOneScoped(id);

		if (bin.isBlocked) {
			throw new BadRequestException(
				`BIN_BLOCKED: bin ${bin.code} is out of service, so units cannot be placed in it.`
			);
		}

		if (!this.stockLedger) {
			throw new BadRequestException(
				'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so the units cannot be walked into the bin.'
			);
		}

		return await this.stockLedger.putAway({
			warehouseId: input.warehouseId,
			variantId: input.variantId,
			binId: bin.id,
			quantity: input.quantity,
			...(input.fromBinId ? { fromBinId: input.fromBinId } : {}),
			...(input.stockMovementId ? { stockMovementId: input.stockMovementId } : {}),
			// The document the walk is recorded against is the receipt line's own movement when the caller
			// has one, and the caller's own row otherwise: every quantity change names what caused it.
			referenceType: 'PUTAWAY',
			referenceId: input.stockMovementId ?? input.referenceId ?? bin.id,
			...(input.reason ? { reason: input.reason } : {})
		});
	}

	/**
	 * Reconciles the placement of a location against the movement ledger and the level rows.
	 *
	 * The invariant is a **sum identity per variant** (doc 09 §15.1, INV-23), evaluated over the bins
	 * of the run:
	 *
	 * ```text
	 * placed            = Σ binQuantity(bin, variant) over the bins of the run
	 * unplaced          = the units the ledger holds at the location with no bin of the run
	 * placed + unplaced = level.quantity
	 * ```
	 *
	 * A bin is never compared against the level row on its own. Stock sits in a bulk or a pick face as
	 * legitimately as it sits at the address the level declares, so the only comparison that means
	 * anything is the location's total against the level's quantity — and, because the level row *does*
	 * declare one address, what the declared bin holds against the quantity the level declares for it.
	 *
	 * §14.10's table decides what the run does with what it finds, and every correction it writes is a
	 * **relocation pair** stated to the inventory capability: the units leave the bin holding the
	 * surplus — or the receiving/default bin, where units without an address physically sit, when the
	 * surplus is unattributed — and arrive at the bin the level row declares. The location's `quantity`
	 * and `reservedQuantity` are therefore the same before and after (INV-27) and a correction can
	 * never be mistaken for a stock adjustment. A quantity disagreement between the ledger's total and
	 * the level row is **reported and not adjusted here**, for the same reason: no relocation can change
	 * a location's total, and setting a level to the ledger sum is the quantity-drift rule's business
	 * (§10.5). No movement is written when the location has no second bin to move units between — the
	 * report says what is wrong and no bin is ever invented to hold the difference.
	 *
	 * The correction is the gap between what the declared bin holds and what the level declares for it,
	 * so the run is a fixpoint: a second run over the state it corrected finds nothing left to move. A
	 * run the caller narrowed to some of the location's bins reports a declaration outside them and
	 * writes nothing, because the partition it was asked about is the one it may act on.
	 *
	 * @param input The scope of the run and whether it should repair what it finds.
	 * @returns What the run found, one line per affected variant, and the movements it wrote.
	 * @throws BadRequestException when no inventory capability is registered.
	 */
	public async reconcile(input: {
		warehouseId: ID;
		zoneId?: ID;
		binIds?: ID[];
		repair?: boolean;
	}): Promise<IBinReconciliationReport> {
		const ledger = this.stockLedger;

		if (!ledger) {
			throw new BadRequestException(
				'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so a reconciliation has nothing to compare against.'
			);
		}

		const binIds = await this.resolveReconciliationScope(input);
		const ledgerBalances = await ledger.readBinBalances(binIds);
		const claimedBalances = await ledger.readExpectedBinBalances({
			warehouseId: input.warehouseId,
			binIds
		});
		const settings = await this.readLocationSettings(input.warehouseId);
		const receivingBinId = await this.resolveReceivingBinId(input.warehouseId, settings.defaultBinId);

		// What the ledger derived per bin of the run, by variant and then by bin: this is `placed`.
		const placement = new Map<string, Map<string, DecimalString>>();

		for (const balance of ledgerBalances) {
			if (!balance.binId) {
				continue;
			}

			const byBin = placement.get(String(balance.variantId)) ?? new Map<string, DecimalString>();

			byBin.set(String(balance.binId), normalizeQuantity(balance.quantity));
			placement.set(String(balance.variantId), byBin);
		}

		// Every variant the run has something to say about: the ones the ledger holds in a bin of the
		// run, and the ones a level row addresses to one of those bins. Sorted, so that two runs over
		// one state report the same findings in the same order.
		const variantIds = [
			...new Set([...placement.keys(), ...claimedBalances.map((claim) => String(claim.variantId))])
		].sort();

		const lines: IBinReconciliationLine[] = [];
		const movementIds: ID[] = [];
		let placedTotal: DecimalString = '0.000000';
		let unplacedTotal: DecimalString = '0.000000';
		let driftCount = 0;

		for (const variantId of variantIds) {
			const bins = placement.get(variantId) ?? new Map<string, DecimalString>();
			const placedQuantity = sumQuantities([...bins.values()]);
			const locationBalance = await ledger.readBinBalance({ warehouseId: input.warehouseId, variantId });
			// The ledger's own total for the pair, less what the bins of the run hold: the units it
			// holds at the location with no address in scope. Over a whole location that is exactly the
			// movements with no bin, which is `unplaced` of §14.10.
			const unplacedQuantity = subtractQuantities(locationBalance?.quantity ?? '0', placedQuantity);
			const countedQuantity = addQuantities(placedQuantity, unplacedQuantity);
			const level = await ledger.resolveHomeBin({ warehouseId: input.warehouseId, variantId });
			const expectedQuantity = normalizeQuantity(level?.quantity ?? '0');
			const difference = subtractQuantities(countedQuantity, expectedQuantity);

			// The address the finding is about: the bin the level row declares as home, the location's
			// receiving/default bin when it declares none, and — when the location has neither — the bin
			// of the run that holds the units, which is where they actually are.
			const homeBinId = level?.binId;
			const declaredBinId = homeBinId ?? receivingBinId ?? largestHolder(bins);
			const declaredQuantity = declaredBinId
				? await this.readBinQuantity(ledger, input.warehouseId, variantId, declaredBinId, bins)
				: undefined;
			// What the declared bin should hold: the level's quantity, less the units the location
			// tolerates as unaddressed — unless it requires every unit to be placed.
			const declaredTarget = settings.requireFullPlacement
				? expectedQuantity
				: subtractQuantities(expectedQuantity, unplacedQuantity);
			const placementGap = declaredQuantity === undefined
				? ('0.000000' as DecimalString)
				: subtractQuantities(declaredTarget, declaredQuantity);

			const unplaced = isPositiveQuantity(unplacedQuantity);
			const quantityAgrees = isSameQuantity(difference, '0');
			const placementAgrees = isSameQuantity(placementGap, '0');

			placedTotal = addQuantities(placedTotal, placedQuantity);
			unplacedTotal = addQuantities(unplacedTotal, unplacedQuantity);

			if (quantityAgrees && placementAgrees && !unplaced) {
				// §14.10, first row: the bins and the level row agree and every unit is addressed.
				continue;
			}

			// A run narrowed to some of the location's bins reports a declaration that lies outside
			// them and moves nothing: a correction that reached into a position the caller excluded
			// would act on a partition the run was not asked about, which is how a count of one aisle
			// ends up rearranging the building.
			const declaredInScope = binIds.some((id) => String(id) === String(declaredBinId));
			const correction =
				input.repair && declaredBinId && declaredInScope
					? await this.correctPlacement({
							ledger,
							warehouseId: input.warehouseId,
							variantId,
							bins,
							declaredBinId,
							receivingBinId,
							declaredTarget,
							unplacedQuantity,
							gap: placementGap
						})
					: undefined;

			if (correction) {
				movementIds.push(...correction.movementIds);
			}

			if (!quantityAgrees || !placementAgrees) {
				driftCount++;
			}

			lines.push({
				binId: declaredBinId as ID,
				variantId,
				expectedQuantity,
				countedQuantity,
				difference,
				repaired: Boolean(correction),
				placedQuantity,
				unplacedQuantity,
				...(homeBinId ? { homeBinId } : {}),
				...(declaredQuantity === undefined ? {} : { declaredQuantity }),
				...(correction ? { relocatedQuantity: correction.quantity } : {})
			});
		}

		await this.refreshBalanceSnapshots(input.warehouseId, binIds, ledgerBalances);

		return {
			warehouseId: input.warehouseId,
			binIds,
			lines,
			driftCount,
			movementIds,
			placedQuantity: placedTotal,
			unplacedQuantity: unplacedTotal
		};
	}

	/**
	 * Writes the one relocation pair a finding asks for, and nothing when no pair of bins could carry
	 * it.
	 *
	 * The quantum is what the declared bin is short of — or holds beyond — what the level declares for
	 * it, and never more than the source can account for: a correction that moved units no bin holds
	 * would invent stock, which is the one thing a relocation must never do. The source is the bin
	 * holding the surplus when a bin of the run holds units the level does not declare there; when the
	 * units are unattributed they come from the receiving/default bin, which is where units without an
	 * address physically sit, and there the unaddressed pool plus what that bin itself holds is what
	 * bounds the move.
	 *
	 * @param input The finding, the ledger the pair is stated to, and the bins it may name.
	 * @returns The pair's movement ids and the quantity it moved, or undefined when nothing could be
	 * moved — a declared bin that is also the receiving bin, or a location holding no units the
	 * correction could account for, is reported and left alone rather than given a fabricated bin.
	 */
	private async correctPlacement(input: {
		ledger: IWarehouseStockLedgerPort;
		warehouseId: ID;
		variantId: ID;
		bins: Map<string, DecimalString>;
		declaredBinId: ID;
		receivingBinId?: ID;
		declaredTarget: DecimalString;
		unplacedQuantity: DecimalString;
		gap: DecimalString;
	}): Promise<IPlacementCorrection | undefined> {
		const { ledger, warehouseId, variantId, bins, declaredBinId, receivingBinId, declaredTarget, gap } = input;
		let fromBinId: ID | undefined = declaredBinId;
		let toBinId: ID | undefined = receivingBinId;
		let quantity: DecimalString = isNegativeQuantity(gap)
			? fromQuantityUnits(-toQuantityUnits(gap))
			: '0.000000';

		if (isPositiveQuantity(gap)) {
			// The declared bin holds less than the level declares: the units are in another bin of the
			// location when one of them holds more than the level claims for it, and unaddressed when
			// none does.
			const surplus = surplusBin(bins, declaredBinId, declaredTarget);
			const source = surplus?.binId ?? receivingBinId;

			if (source) {
				const available = surplus
					? surplus.quantity
					: addQuantities(
							input.unplacedQuantity,
							await this.readBinQuantity(ledger, warehouseId, variantId, source, bins)
						);

				fromBinId = source;
				toBinId = declaredBinId;
				quantity = isGreaterThan(gap, available) ? available : gap;
			}
		}

		if (!fromBinId || !toBinId || String(fromBinId) === String(toBinId) || !isPositiveQuantity(quantity)) {
			return undefined;
		}

		const movements = await ledger.relocate({
			warehouseId,
			variantId,
			fromBinId,
			toBinId,
			quantity,
			referenceType: RECONCILIATION_REFERENCE_TYPE,
			referenceId: declaredBinId,
			reason: RECONCILIATION_REASON
		});

		return { movementIds: movements.map((movement) => movement.movementId), quantity };
	}

	/**
	 * Reads what one bin holds of one variant, from the run's own read when it covered that bin and
	 * from the ledger otherwise — the declared bin can lie outside the scope of a narrowed run.
	 *
	 * @param ledger The inventory capability.
	 * @param warehouseId The location.
	 * @param variantId The variant.
	 * @param binId The bin.
	 * @param bins What the run already read, by bin.
	 * @returns The bin's derived quantity, zero when the ledger holds nothing for the pair.
	 */
	private async readBinQuantity(
		ledger: IWarehouseStockLedgerPort,
		warehouseId: ID,
		variantId: ID,
		binId: ID,
		bins: Map<string, DecimalString>
	): Promise<DecimalString> {
		const known = bins.get(String(binId));

		if (known !== undefined) {
			return known;
		}

		const balance = await ledger.readBinBalance({ warehouseId, variantId, binId });

		return normalizeQuantity(balance?.quantity ?? '0');
	}

	/**
	 * Reads the settings a count obeys from the location's own metadata.
	 *
	 * `requireFullPlacement` decides whether units the ledger holds without an address are moved into
	 * the bin the level declares, and it is `false` unless the tenant states otherwise: addressing
	 * every unit is a decision a building makes, not a default the platform imposes. `defaultBinId`
	 * names the bin those units physically sit in; a location that names none falls back to the first
	 * bin of its receiving area.
	 *
	 * @param warehouseId The location.
	 * @returns The two settings, with the documented defaults when the location states none or the
	 * kernel's own entity is not registered in this installation.
	 */
	private async readLocationSettings(warehouseId: ID): Promise<{ requireFullPlacement: boolean; defaultBinId?: ID }> {
		if (!this.typeOrmWarehouseRepository) {
			return { requireFullPlacement: false };
		}

		const location = await this.typeOrmWarehouseRepository.findOne({
			where: {
				id: warehouseId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});
		const metadata = readMetadata(location?.metadata);
		const defaultBinId = metadata.defaultBinId;

		return {
			requireFullPlacement: metadata.requireFullPlacement === true,
			...(typeof defaultBinId === 'string' && defaultBinId ? { defaultBinId: defaultBinId as ID } : {})
		};
	}

	/**
	 * Resolves the bin a location's unaddressed units sit in.
	 *
	 * The location names it in `metadata.defaultBinId`; when it names none, the first bin of its
	 * receiving area is the same place under the name the building uses, because goods are unloaded
	 * there and stay there until put-away addresses them. Nothing is ever created here: an invented
	 * address is worse than a report that says the location has none.
	 *
	 * @param warehouseId The location.
	 * @param defaultBinId The bin the location names, when it names one.
	 * @returns The bin, or undefined when the location has neither.
	 */
	private async resolveReceivingBinId(warehouseId: ID, defaultBinId?: ID): Promise<ID | undefined> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (defaultBinId) {
			const named = await this.typeOrmWarehouseBinRepository.findOne({
				where: { id: defaultBinId, warehouseId, tenantId, organizationId }
			});

			if (named) {
				return named.id;
			}
		}

		const zones = await this.typeOrmWarehouseZoneRepository.find({
			where: { warehouseId, type: WarehouseZoneType.RECEIVING, tenantId, organizationId },
			order: { priority: 'DESC', code: 'ASC' }
		});

		for (const zone of zones ?? []) {
			const bins = await this.typeOrmWarehouseBinRepository.find({
				where: { warehouseId, zoneId: zone.id, tenantId, organizationId },
				order: { sortOrder: 'ASC', code: 'ASC' }
			});

			if (bins?.length) {
				return bins[0].id;
			}
		}

		return undefined;
	}

	/**
	 * Rewrites the balance snapshot a bin caches, which is a cache and never an authority.
	 *
	 * `warehouse_bin.metadata.balances` is the snapshot §14.10 keeps beside the derived figure so the
	 * planning and reporting paths can read a balance without a range sum over the ledger. A snapshot
	 * that disagrees with what the ledger derives is rewritten and nothing else happens: a snapshot is
	 * not a movement, and writing one into the ledger would invent stock. The row's other metadata and
	 * its version are left as they are — this is a refresh of a cache, not an operator's edit.
	 *
	 * @param warehouseId The location the bins belong to.
	 * @param binIds The bins of the run.
	 * @param balances What the ledger derived, per bin and variant.
	 */
	private async refreshBalanceSnapshots(
		warehouseId: ID,
		binIds: ID[],
		balances: IWarehouseBinBalance[]
	): Promise<void> {
		if (!binIds.length) {
			return;
		}

		const bins = await this.typeOrmWarehouseBinRepository.find({
			where: {
				id: In(binIds),
				warehouseId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});
		const derived = new Map<string, Record<string, DecimalString>>();

		for (const balance of balances) {
			if (!balance.binId) {
				continue;
			}

			const snapshot = derived.get(String(balance.binId)) ?? {};

			snapshot[String(balance.variantId)] = normalizeQuantity(balance.quantity);
			derived.set(String(balance.binId), snapshot);
		}

		for (const bin of bins ?? []) {
			const metadata = readMetadata(bin.metadata);
			const current = derived.get(String(bin.id)) ?? {};

			if (snapshotsAgree(metadata[BIN_BALANCES_KEY], current)) {
				continue;
			}

			await this.typeOrmWarehouseBinRepository.update(bin.id, {
				metadata: {
					...metadata,
					[BIN_BALANCES_KEY]: current,
					[BIN_BALANCE_UPDATED_AT_KEY]: new Date().toISOString()
				}
			} as any);
		}
	}

	/**
	 * Reads every descendant of a bin, itself included, from the closure table.
	 *
	 * @param id The ancestor.
	 * @returns The descendant ids.
	 */
	public async descendantIds(id: ID): Promise<ID[]> {
		const rows: Array<{ id_descendant: string }> = await this.runClosureStatement(
			`SELECT "id_descendant" FROM "warehouse_bin_closure" WHERE "id_ancestor" = :ancestorId`,
			{ ancestorId: id }
		);

		return rows.map((row) => row.id_descendant as ID);
	}

	/**
	 * Reads every ancestor of a bin, itself included, from the closure table.
	 *
	 * @param id The descendant.
	 * @returns The ancestor ids.
	 */
	public async ancestorIds(id: ID): Promise<ID[]> {
		const rows: Array<{ id_ancestor: string }> = await this.runClosureStatement(
			`SELECT "id_ancestor" FROM "warehouse_bin_closure" WHERE "id_descendant" = :descendantId`,
			{ descendantId: id }
		);

		return rows.map((row) => row.id_ancestor as ID);
	}

	/**
	 * Runs one statement against the closure table, on whichever dialect is configured.
	 *
	 * **The six statements in this file ran on SQLite and on nothing else.** They wrote their
	 * identifiers in double quotes, which MySQL reads as a string literal rather than a column, and
	 * they wrote their parameters as `?`, which Postgres does not bind at all. The closure table is
	 * what every ancestor and descendant read in this service goes through — placement, moves, the
	 * capacity roll-up — so a warehouse tree on either of those two dialects failed on the first
	 * query and stayed failed.
	 *
	 * Nothing below `QueryBuilder` rewrites either spelling, so both are rewritten here: the
	 * identifiers by `prepareSQLQuery`, which is what the rest of this platform uses, and the named
	 * parameters by `toPositionalStatement`, which binds them in the form the configured driver
	 * expects. The statements above are written once, in the one spelling a reader can check against
	 * the migration that created the table.
	 *
	 * The closure table is deliberately not an entity — the ORM's tree strategy owns its contents, and
	 * a second declared writer could disagree with it — so these reads cannot go through a repository
	 * and a raw statement is the only form available.
	 *
	 * @param sql The statement, with `:name` parameters and double-quoted identifiers.
	 * @param parameters The values, keyed by name.
	 * @returns Whatever the driver answered.
	 */
	private async runClosureStatement(sql: string, parameters: Record<string, unknown>): Promise<any> {
		const bound = toPositionalStatement(prepareSQLQuery(sql), parameters);

		return this.typeOrmWarehouseBinRepository.query(bound.sql, bound.parameters);
	}

	/**
	 * Writes the closure rows that place a new bin in the tree.
	 *
	 * A bin is its own ancestor — the self-pair is what makes a descendant query return the node itself
	 * — and every ancestor of its parent becomes an ancestor of the new bin.
	 *
	 * @param binId The new bin.
	 * @param parentId Its parent, when it has one.
	 */
	private async linkIntoClosure(binId: ID, parentId?: ID): Promise<void> {
		await this.insertClosurePairs([[binId, binId]]);

		if (!parentId) {
			return;
		}

		const ancestors = await this.ancestorIds(parentId);
		const pairs = ancestors.map((ancestorId) => [ancestorId, binId] as [ID, ID]);

		await this.insertClosurePairs(pairs);
	}

	/**
	 * Rewrites the closure rows of a subtree after it moved.
	 *
	 * The subtree keeps its internal ancestry — the pairs that made a shelf a descendant of the rack it
	 * sits in — and gains the new parent's ancestry; the rows that described the old placement are
	 * removed first, so the operation is idempotent and a partial failure cannot leave a node with two
	 * parents' worth of ancestors.
	 *
	 * The internal pairs are read **before** the placement rows are deleted, because the deletion takes
	 * them with it: they are the ones that make every descendant query reach past the moved node, and a
	 * subtree that lost them answers with the node alone while the shelf below it is still physically
	 * under it — damage that compounds with each move.
	 *
	 * @param binId The bin that moved.
	 * @param parentId Its new parent, when it has one.
	 */
	private async relinkClosure(binId: ID, parentId?: ID): Promise<void> {
		const descendants = await this.descendantIds(binId);
		const subtree = descendants.length ? descendants : [binId];
		const members = new Set(subtree.map(String));
		const pairs: Array<[ID, ID]> = [];

		for (const descendantId of subtree) {
			const ancestors = await this.ancestorIds(descendantId);

			for (const ancestorId of ancestors) {
				if (members.has(String(ancestorId))) {
					pairs.push([ancestorId, descendantId]);
				}
			}

			// A bin is its own ancestor even when the pair that says so was missing, so the self-pair is
			// stated here rather than only read back.
			pairs.push([descendantId, descendantId]);
		}

		await this.removeFromClosure(binId, subtree);

		if (parentId) {
			const ancestors = await this.ancestorIds(parentId);

			for (const ancestorId of ancestors) {
				for (const descendantId of subtree) {
					pairs.push([ancestorId, descendantId]);
				}
			}
		}

		await this.insertClosurePairs(uniquePairs(pairs));
	}

	/**
	 * Removes the closure rows that describe a subtree's placement.
	 *
	 * @param binId The root of the subtree.
	 * @param subtree The subtree's ids, itself included; read from the closure table when omitted.
	 */
	private async removeFromClosure(binId: ID, subtree?: ID[]): Promise<void> {
		const ids = subtree ?? (await this.descendantIds(binId));

		if (!ids.length) {
			return;
		}

		// The list is variable-length, so the names are generated with it and bound by the same
		// rewrite every other statement here goes through.
		const named = ids.map((_id, index) => `:id${index}`).join(', ');
		const values = Object.fromEntries(ids.map((value, index) => [`id${index}`, value]));

		await this.runClosureStatement(
			`DELETE FROM "warehouse_bin_closure" WHERE "id_descendant" IN (${named})`,
			values
		);
	}

	/**
	 * Writes closure pairs, ignoring the ones that are already there.
	 *
	 * @param pairs The ancestor/descendant pairs.
	 */
	private async insertClosurePairs(pairs: Array<[ID, ID]>): Promise<void> {
		for (const [ancestorId, descendantId] of pairs) {
			const existing: Array<{ id_ancestor: string }> = await this.runClosureStatement(
				`SELECT "id_ancestor" FROM "warehouse_bin_closure" WHERE "id_ancestor" = :ancestorId AND "id_descendant" = :descendantId`,
				{ ancestorId, descendantId }
			);

			if (existing.length) {
				continue;
			}

			await this.runClosureStatement(
				`INSERT INTO "warehouse_bin_closure" ("id_ancestor", "id_descendant") VALUES (:ancestorId, :descendantId)`,
				{ ancestorId, descendantId }
			);
		}
	}

	/**
	 * @param id The bin.
	 * @returns How many levels above the root it sits at; zero for a root.
	 */
	private async depthOf(id: ID): Promise<number> {
		const ancestors = await this.ancestorIds(id);

		return ancestors.length > 0 ? ancestors.length - 1 : 0;
	}

	/**
	 * @param id The bin.
	 * @returns How many levels the subtree under it spans; one for a leaf.
	 */
	private async subtreeHeight(id: ID): Promise<number> {
		const descendants = await this.descendantIds(id);

		if (descendants.length <= 1) {
			return 1;
		}

		let deepest = 0;

		for (const descendantId of descendants) {
			deepest = Math.max(deepest, await this.depthOf(descendantId));
		}

		const ownDepth = await this.depthOf(id);

		return deepest - ownDepth + 1;
	}

	/**
	 * @param warehouseId The location.
	 * @param code The code to check.
	 * @throws BadRequestException when the code is already used inside the location.
	 */
	private async assertCodeIsFree(warehouseId: ID, code: string): Promise<void> {
		const existing = await this.typeOrmWarehouseBinRepository.findOne({
			where: {
				warehouseId,
				code,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (existing) {
			throw new BadRequestException(`The code "${code}" is already used by a bin of this location.`);
		}
	}

	/**
	 * @param warehouseId The location.
	 * @param zoneId The zone, when one was named.
	 * @throws BadRequestException when the zone belongs to another location.
	 */
	private async assertZoneBelongsToLocation(warehouseId: ID, zoneId?: ID): Promise<void> {
		if (!zoneId) {
			return;
		}

		const zone: WarehouseZone = await this.typeOrmWarehouseZoneRepository.findOne({
			where: {
				id: zoneId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!zone) {
			throw new BadRequestException('The zone named for this bin does not exist.');
		}

		if (String(zone.warehouseId) !== String(warehouseId)) {
			throw new BadRequestException('BIN_LOCATION_MISMATCH: the zone belongs to another location.');
		}
	}

	/**
	 * @param warehouseId The location.
	 * @param zoneId The zone of the bin being written.
	 * @param parentId The stated parent.
	 * @param binId The bin being written, when it already exists.
	 * @throws BadRequestException when the parent is in another location or another zone.
	 */
	private async assertParentIsUsable(
		warehouseId: ID,
		zoneId: ID | undefined,
		parentId: ID | undefined,
		binId: ID | undefined
	): Promise<void> {
		if (!parentId) {
			return;
		}

		const parent = await this.typeOrmWarehouseBinRepository.findOne({
			where: {
				id: parentId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!parent) {
			throw new BadRequestException('The parent bin does not exist.');
		}

		if (String(parent.warehouseId) !== String(warehouseId)) {
			throw new BadRequestException('BIN_LOCATION_MISMATCH: the parent bin belongs to another location.');
		}

		if (String(parent.zoneId ?? '') !== String(zoneId ?? '')) {
			throw new BadRequestException('A bin may only nest inside a bin of its own zone.');
		}

		if (binId) {
			const descendants = await this.descendantIds(binId);

			if (descendants.some((descendantId) => String(descendantId) === String(parentId))) {
				throw new BadRequestException('BIN_HIERARCHY_CYCLE: the parent is inside the subtree of the bin itself.');
			}
		}

		if ((await this.depthOf(parentId)) + 1 + (binId ? (await this.subtreeHeight(binId)) - 1 : 0) > MAX_BIN_DEPTH - 1) {
			throw new BadRequestException(
				`BIN_HIERARCHY_TOO_DEEP: the hierarchy may not exceed ${MAX_BIN_DEPTH} levels.`
			);
		}
	}

	/**
	 * @param binId The bin.
	 * @throws BadRequestException when a printed pick line names its code.
	 */
	private async assertCodeIsNotPrinted(binId: ID): Promise<void> {
		const rows: Array<{ total: number | string }> = await this.runClosureStatement(
			`SELECT COUNT(*) AS total FROM "pick_list_line" WHERE "binId" = :binId AND "deletedAt" IS NULL`,
			{ binId: binId }
		);

		const total = Number(rows?.[0]?.total ?? 0);

		if (total > 0) {
			throw new BadRequestException(
				`BIN_CODE_IMMUTABLE: ${total} pick line(s) already name this bin, so its printed code cannot change.`
			);
		}
	}

	/**
	 * @param input The reconciliation scope.
	 * @returns The bins the run covers.
	 */
	private async resolveReconciliationScope(input: {
		warehouseId: ID;
		zoneId?: ID;
		binIds?: ID[];
	}): Promise<ID[]> {
		if (input.binIds?.length) {
			return input.binIds;
		}

		const bins = await this.typeOrmWarehouseBinRepository.find({
			where: {
				warehouseId: input.warehouseId,
				...(input.zoneId ? { zoneId: input.zoneId } : {}),
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		return bins.map((bin) => bin.id);
	}

	/**
	 * Writes one position under the version it was read at, or refuses.
	 *
	 * `commitVersionedUpdate` is the platform's conditional write: it resolves the version the caller
	 * accepted, predicates the `UPDATE` on it and increments it in the same statement, so the
	 * affected-row count is the whole answer and there is no window between deciding and acting. Three
	 * writes on this service used to compute `version + 1` in application code and issue it through the
	 * unconditional base updater — the same shape the branch notes name on `FulfillmentService.move()`
	 * — which meant two operators editing one position from the same reading both landed, both claimed
	 * the version they had computed, and any client holding an entity tag of that version read a row
	 * neither write produced.
	 *
	 * **The tenant and the organization go in `where`, not in the patch.** That member is the kernel's
	 * place for the scope a statement must also satisfy, and the row's own scope is what is stated
	 * rather than the request's: a write reached from a worker or a job has no request scope to read,
	 * and the row it is correcting still belongs to exactly one tenant.
	 *
	 * The kernel reaches storage through the service it is handed, and this service's own `update` is
	 * an override that validates a caller's edit rather than a storage surface — handing it to the
	 * kernel would re-enter the validation with a criteria object in place of an id. The adapter below
	 * is the base class's own dual-ORM `update` and read-back, which is the surface the kernel expects,
	 * so the statement, the conflict and the increment stay the kernel's.
	 *
	 * @param bin The position as it was read, which is the version the statement is predicated on.
	 * @param patch The columns to write. `version` is the statement's own and must not be in it.
	 * @returns The version the position now holds.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the position moved past that version, or
	 * with `RESOURCE_NOT_FOUND` when it is gone.
	 */
	private async commitBinUpdate(bin: WarehouseBin, patch: Record<string, unknown>): Promise<number> {
		const writer = {
			update: (criteria: Record<string, unknown>, columns: Record<string, unknown>) =>
				super.update(criteria as never, columns as never),
			findOneByIdString: (id: ID) => super.findOneByIdString(id)
		};

		const committed = await commitVersionedUpdate(
			writer as unknown as Parameters<typeof commitVersionedUpdate>[0],
			{
				id: bin.id,
				expectation: acceptedVersionExpectation() ?? ANY_VERSION,
				patch,
				where: {
					...(bin.tenantId ? { tenantId: bin.tenantId } : {}),
					...(bin.organizationId ? { organizationId: bin.organizationId } : {})
				},
				// The version this service already read under its own scoped read, so the wildcard case
				// reaches the statement without a second round trip for a value that is in hand.
				readVersion: async () => this.readVersion(bin)
			}
		);

		return committed.version;
	}

	/**
	 * The counter a position holds.
	 *
	 * A row written before the column existed, or one whose value is unusable, is treated as being at
	 * one — the value the column's own default gives it — so the comparison has a number to work with
	 * rather than a gap.
	 *
	 * @param bin The position.
	 * @returns The version.
	 */
	private readVersion(bin: WarehouseBin): number {
		const version = Number((bin as { version?: unknown })?.version ?? 1);

		return Number.isSafeInteger(version) && version > 0 ? version : 1;
	}
}

/** What one placement correction wrote: the ids of the pair's two rows and the quantity it moved. */
interface IPlacementCorrection {
	movementIds: ID[];
	quantity: DecimalString;
}

/** A decimal quantity, as a metadata snapshot may state one. */
const SNAPSHOT_QUANTITY_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * @param bins What the bins of a run hold, by bin.
 * @returns The bin holding the most of the variant, or undefined when every bin is empty.
 */
function largestHolder(bins: Map<string, DecimalString>): ID | undefined {
	let holder: ID | undefined;
	let held: DecimalString = '0.000000';

	for (const [binId, quantity] of bins) {
		if (!isPositiveQuantity(quantity) || !isGreaterThan(quantity, held)) {
			continue;
		}

		holder = binId as ID;
		held = quantity;
	}

	return holder;
}

/**
 * The bin of a run holding units the level does not declare for it.
 *
 * A level row names one address, so it claims its quantity there and nothing anywhere else: a bin
 * other than the declared one that holds units is holding a surplus the declaration does not account
 * for, and it is the bin a correction moves them out of. When the declared bin itself holds more than
 * the level declares, its own surplus is the finding rather than a source, so it is not a candidate
 * here.
 *
 * @param bins What the bins of a run hold, by bin.
 * @param declaredBinId The bin the level declares.
 * @param declaredTarget What the level declares for it.
 * @returns The bin with the largest surplus, or undefined when no bin holds one.
 */
function surplusBin(
	bins: Map<string, DecimalString>,
	declaredBinId: ID,
	declaredTarget: DecimalString
): { binId: ID; quantity: DecimalString } | undefined {
	let surplus: { binId: ID; quantity: DecimalString } | undefined;

	for (const [binId, quantity] of bins) {
		if (String(binId) === String(declaredBinId) || !isPositiveQuantity(quantity)) {
			continue;
		}

		if (surplus === undefined || isGreaterThan(quantity, surplus.quantity)) {
			surplus = { binId: binId as ID, quantity: normalizeQuantity(quantity) };
		}
	}

	return surplus;
}

/**
 * Reads a `metadata` column as the object it holds.
 *
 * A JSON column is an object on one dialect and the text of one on another, and a count that read the
 * text as a map would silently obey no setting at all — which is how a location that requires full
 * placement stops requiring it without anybody editing it.
 *
 * @param value The column as the driver returned it.
 * @returns The object it states, or an empty one when it states none.
 */
function readMetadata(value: unknown): Record<string, unknown> {
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);

			return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: {};
		} catch {
			return {};
		}
	}

	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * @param value One entry of a cached snapshot.
 * @returns The quantity it states, or undefined when it states something that is not a quantity.
 */
function snapshotQuantity(value: unknown): DecimalString | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return `${value}` as DecimalString;
	}

	if (typeof value === 'string' && SNAPSHOT_QUANTITY_PATTERN.test(value.trim())) {
		return value.trim() as DecimalString;
	}

	return undefined;
}

/**
 * @param cached What a bin caches under `balances`, as it was stored.
 * @param derived What the ledger derives now, by variant.
 * @returns True when the cache already states the derived figures and nothing else.
 */
function snapshotsAgree(cached: unknown, derived: Record<string, DecimalString>): boolean {
	const stated = readMetadata(cached);
	const variants = new Set([...Object.keys(stated), ...Object.keys(derived)]);

	for (const variantId of variants) {
		const quantity = snapshotQuantity(stated[variantId]);

		if (quantity === undefined || !isSameQuantity(quantity, derived[variantId] ?? '0')) {
			return false;
		}
	}

	return true;
}

/**
 * @param pairs Ancestor/descendant pairs, possibly with repeats.
 * @returns The pairs, each stated once.
 */
function uniquePairs(pairs: Array<[ID, ID]>): Array<[ID, ID]> {
	const seen = new Set<string>();
	const unique: Array<[ID, ID]> = [];

	for (const pair of pairs) {
		const key = `${pair[0]}:${pair[1]}`;

		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		unique.push(pair);
	}

	return unique;
}
