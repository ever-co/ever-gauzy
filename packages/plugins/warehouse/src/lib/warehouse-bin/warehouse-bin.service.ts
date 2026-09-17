import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DeleteResult, In } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { WarehouseZone } from '../warehouse-zone/warehouse-zone.entity';
import { TypeOrmWarehouseZoneRepository } from '../warehouse-zone/repository/type-orm-warehouse-zone.repository';
import {
	IBinReconciliationLine,
	IBinReconciliationReport,
	IWarehouseBinRangeInput,
	IWarehouseStockLedgerPort,
	WAREHOUSE_STOCK_LEDGER,
	WarehouseBinType,
	WarehouseStockMovementKind
} from '../warehouse.types';
import { normalizeQuantity, subtractQuantities, toQuantityUnits } from '../warehouse.quantity';
import { WarehouseBin } from './warehouse-bin.entity';
import { MikroOrmWarehouseBinRepository } from './repository/mikro-orm-warehouse-bin.repository';
import { TypeOrmWarehouseBinRepository } from './repository/type-orm-warehouse-bin.repository';

/** How deep the bin hierarchy may go, counting the root as level one. */
const MAX_BIN_DEPTH = 5;

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
 * here, so reconciliation compares what the level rows claim with what the ledger recorded and
 * **writes the difference as a movement through the inventory capability**. This service never moves a
 * quantity itself: two writers of one level is how a level drifts.
 */
@Injectable()
export class WarehouseBinService extends TenantAwareCrudService<WarehouseBin> {
	constructor(
		readonly typeOrmWarehouseBinRepository: TypeOrmWarehouseBinRepository,
		readonly mikroOrmWarehouseBinRepository: MikroOrmWarehouseBinRepository,
		private readonly typeOrmWarehouseZoneRepository: TypeOrmWarehouseZoneRepository,
		@Optional()
		@Inject(WAREHOUSE_STOCK_LEDGER)
		private readonly stockLedger?: IWarehouseStockLedgerPort
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

		const bin = await super.create({
			...entity,
			type: entity.type ?? WarehouseBinType.SHELF,
			isPickable: entity.isPickable ?? true,
			isBlocked: entity.isBlocked ?? false,
			sortOrder: entity.sortOrder ?? 0,
			version: 1,
			capacityUnits: entity.capacityUnits ? normalizeQuantity(entity.capacityUnits) : undefined,
			maxWeight: entity.maxWeight ? normalizeQuantity(entity.maxWeight) : undefined,
			maxVolume: entity.maxVolume ? normalizeQuantity(entity.maxVolume) : undefined,
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
	 * @param id The bin to update.
	 * @param entity The fields to change.
	 * @returns The updated bin.
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

		await super.update(id, {
			...entity,
			warehouseId: bin.warehouseId,
			zoneId: bin.zoneId,
			parentId: bin.parentId,
			version: (bin.version ?? 1) + 1
		} as any);

		return await this.findOneScoped(id);
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

		await super.update(id, {
			parentId: parentId ?? null,
			version: (bin.version ?? 1) + 1
		} as any);

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
	 */
	public async setBlocked(id: ID, isBlocked: boolean): Promise<WarehouseBin> {
		const bin = await this.findOneScoped(id);

		await super.update(id, { isBlocked, version: (bin.version ?? 1) + 1 } as any);

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
	 * Reconciles the bins of a location against the movement ledger.
	 *
	 * What the level rows claim is in a bin and what the ledger recorded moving through it are two
	 * different numbers computed from two different places, and the report is where they disagree. The
	 * repair is a `COUNT` movement written through the inventory capability for each difference — this
	 * service states what was found and the ledger decides the level, because the ledger is the only
	 * authority for quantity.
	 *
	 * @param input The scope of the run and whether it should repair what it finds.
	 * @returns What the run found, per bin and variant.
	 * @throws BadRequestException when no inventory capability is registered.
	 */
	public async reconcile(input: {
		warehouseId: ID;
		zoneId?: ID;
		binIds?: ID[];
		repair?: boolean;
	}): Promise<IBinReconciliationReport> {
		if (!this.stockLedger) {
			throw new BadRequestException(
				'WAREHOUSE_STOCK_LEDGER_UNAVAILABLE: the inventory capability is not registered, so a reconciliation has nothing to compare against.'
			);
		}

		const binIds = await this.resolveReconciliationScope(input);
		const ledgerBalances = await this.stockLedger.readBinBalances(binIds);
		const claimedBalances = await this.stockLedger.readExpectedBinBalances({
			warehouseId: input.warehouseId,
			binIds
		});

		const claimed = new Map<string, DecimalString>();

		for (const balance of claimedBalances) {
			claimed.set(`${balance.binId ?? ''}:${balance.variantId}`, balance.quantity);
		}

		const lines: IBinReconciliationLine[] = [];
		const movementIds: ID[] = [];

		for (const balance of ledgerBalances) {
			const key = `${balance.binId ?? ''}:${balance.variantId}`;
			const expected = claimed.get(key) ?? '0';

			if (toQuantityUnits(expected) === toQuantityUnits(balance.quantity)) {
				continue;
			}

			const difference = subtractQuantities(balance.quantity, expected);
			let repaired = false;

			if (input.repair && balance.binId) {
				const movement = await this.stockLedger.recordMovement({
					warehouseId: input.warehouseId,
					variantId: balance.variantId,
					binId: balance.binId,
					quantity: difference,
					kind: WarehouseStockMovementKind.COUNT,
					referenceType: 'WAREHOUSE_BIN_RECONCILIATION',
					referenceId: balance.binId,
					reason: `Bin reconciliation corrected a difference of ${difference}.`
				});

				movementIds.push(movement.movementId);
				repaired = true;
			}

			lines.push({
				binId: balance.binId as ID,
				variantId: balance.variantId,
				expectedQuantity: normalizeQuantity(expected),
				countedQuantity: normalizeQuantity(balance.quantity),
				difference: normalizeQuantity(difference),
				repaired
			});
		}

		return {
			warehouseId: input.warehouseId,
			binIds,
			lines,
			driftCount: lines.length,
			movementIds
		};
	}

	/**
	 * Reads every descendant of a bin, itself included, from the closure table.
	 *
	 * @param id The ancestor.
	 * @returns The descendant ids.
	 */
	public async descendantIds(id: ID): Promise<ID[]> {
		const rows: Array<{ id_descendant: string }> = await this.typeOrmWarehouseBinRepository.query(
			`SELECT "id_descendant" FROM "warehouse_bin_closure" WHERE "id_ancestor" = ?`,
			[id]
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
		const rows: Array<{ id_ancestor: string }> = await this.typeOrmWarehouseBinRepository.query(
			`SELECT "id_ancestor" FROM "warehouse_bin_closure" WHERE "id_descendant" = ?`,
			[id]
		);

		return rows.map((row) => row.id_ancestor as ID);
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
	 * The subtree keeps its internal ancestry and gains the new parent's ancestry; the rows that
	 * described the old placement are removed first, so the operation is idempotent and a partial
	 * failure cannot leave a node with two parents' worth of ancestors.
	 *
	 * @param binId The bin that moved.
	 * @param parentId Its new parent, when it has one.
	 */
	private async relinkClosure(binId: ID, parentId?: ID): Promise<void> {
		const descendants = await this.descendantIds(binId);
		const subtree = descendants.length ? descendants : [binId];

		await this.removeFromClosure(binId, subtree);

		const pairs: Array<[ID, ID]> = subtree.map((descendantId) => [descendantId, descendantId]);

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

		const placeholders = ids.map(() => '?').join(', ');

		await this.typeOrmWarehouseBinRepository.query(
			`DELETE FROM "warehouse_bin_closure" WHERE "id_descendant" IN (${placeholders})`,
			ids
		);
	}

	/**
	 * Writes closure pairs, ignoring the ones that are already there.
	 *
	 * @param pairs The ancestor/descendant pairs.
	 */
	private async insertClosurePairs(pairs: Array<[ID, ID]>): Promise<void> {
		for (const [ancestorId, descendantId] of pairs) {
			const existing: Array<{ id_ancestor: string }> = await this.typeOrmWarehouseBinRepository.query(
				`SELECT "id_ancestor" FROM "warehouse_bin_closure" WHERE "id_ancestor" = ? AND "id_descendant" = ?`,
				[ancestorId, descendantId]
			);

			if (existing.length) {
				continue;
			}

			await this.typeOrmWarehouseBinRepository.query(
				`INSERT INTO "warehouse_bin_closure" ("id_ancestor", "id_descendant") VALUES (?, ?)`,
				[ancestorId, descendantId]
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
		const rows: Array<{ total: number | string }> = await this.typeOrmWarehouseBinRepository.query(
			`SELECT COUNT(*) AS total FROM "pick_list_line" WHERE "binId" = ? AND "deletedAt" IS NULL`,
			[binId]
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
