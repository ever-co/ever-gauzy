import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TypeOrmWarehouseBinRepository } from '../warehouse-bin/repository/type-orm-warehouse-bin.repository';
import { WarehouseZoneType } from '../warehouse.types';
import { normalizeQuantity, toQuantityUnits } from '../warehouse.quantity';
import { WarehouseZone } from './warehouse-zone.entity';
import { MikroOrmWarehouseZoneRepository } from './repository/mikro-orm-warehouse-zone.repository';
import { TypeOrmWarehouseZoneRepository } from './repository/type-orm-warehouse-zone.repository';

/**
 * The areas of a stock location, and the two rules the rest of the domain asks them for.
 *
 * A zone is a configuration row, so most of this service is validation — the visiting order has to be
 * a sequence with no ties, the temperature window has to be a window, and a zone that holds bins is
 * blocked rather than deleted. The interesting part is the other half: **put-away rule resolution**
 * (which areas may accept goods, in preference order) and **picking rule resolution** (which areas may
 * be picked from, in walking order). Both are answered here rather than in each caller, so allocation,
 * the pick path and the capacity plan cannot disagree about which bins are eligible.
 */
@Injectable()
export class WarehouseZoneService extends TenantAwareCrudService<WarehouseZone> {
	constructor(
		readonly typeOrmWarehouseZoneRepository: TypeOrmWarehouseZoneRepository,
		readonly mikroOrmWarehouseZoneRepository: MikroOrmWarehouseZoneRepository,
		private readonly typeOrmWarehouseBinRepository: TypeOrmWarehouseBinRepository
	) {
		super(typeOrmWarehouseZoneRepository, mikroOrmWarehouseZoneRepository);
	}

	/**
	 * Creates a zone inside a location.
	 *
	 * The visiting order is appended to the end of the sequence for the zone's own type unless a caller
	 * states one, because two zones of one type sharing a position is what makes a pick path
	 * non-deterministic.
	 *
	 * @param entity The zone to create.
	 * @returns The created zone.
	 */
	public async create(entity: Partial<WarehouseZone>): Promise<WarehouseZone> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const { warehouseId, code } = entity;

		if (!warehouseId) {
			throw new BadRequestException('A zone must name the location it belongs to.');
		}

		if (!code) {
			throw new BadRequestException('A zone must carry a code.');
		}

		const type = entity.type ?? WarehouseZoneType.STORAGE;

		await this.assertCodeIsFree(warehouseId, code);

		const priority =
			entity.priority ?? (await this.nextPriority(warehouseId, type));

		this.assertTemperatureWindow(entity.minTemperature, entity.maxTemperature);

		return await super.create({
			...entity,
			type,
			priority,
			isPickable: entity.isPickable ?? defaultPickable(type),
			isReceivable: entity.isReceivable ?? defaultReceivable(type),
			isShippable: entity.isShippable ?? type === WarehouseZoneType.SHIPPING,
			isBlocked: entity.isBlocked ?? false,
			version: 1,
			minTemperature: entity.minTemperature ? normalizeQuantity(entity.minTemperature) : undefined,
			maxTemperature: entity.maxTemperature ? normalizeQuantity(entity.maxTemperature) : undefined,
			tenantId,
			organizationId
		} as any);
	}

	/**
	 * Updates a zone.
	 *
	 * The location cannot move: every bin of the zone would silently change address, and a historical
	 * pick names a bin of a zone of a location.
	 *
	 * @param id The zone to update.
	 * @param entity The fields to change.
	 * @returns The updated zone.
	 */
	public async update(id: ID, entity: Partial<WarehouseZone>): Promise<WarehouseZone> {
		const zone = await this.findOneScoped(id);

		if (entity.warehouseId && String(entity.warehouseId) !== String(zone.warehouseId)) {
			throw new BadRequestException('A zone belongs to one location: it cannot be moved to another.');
		}

		const minTemperature = entity.minTemperature ?? zone.minTemperature;
		const maxTemperature = entity.maxTemperature ?? zone.maxTemperature;

		this.assertTemperatureWindow(minTemperature, maxTemperature);

		await super.update(id, {
			...entity,
			warehouseId: zone.warehouseId,
			version: (zone.version ?? 1) + 1
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Takes a zone out of service, or puts it back.
	 *
	 * Blocking never touches the stock inside the area: the units stay where they physically are, and
	 * what changes is that the allocator no longer offers the bins. That is the whole point — a
	 * stocktake or a rebuild has to be able to say "these units are here and nobody may touch them".
	 *
	 * @param id The zone.
	 * @param isBlocked Whether the area is out of service.
	 * @returns The zone.
	 */
	public async setBlocked(id: ID, isBlocked: boolean): Promise<WarehouseZone> {
		const zone = await this.findOneScoped(id);

		await super.update(id, { isBlocked, version: (zone.version ?? 1) + 1 } as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Rewrites the walking order of a location's zones.
	 *
	 * The order is the first key of every pick-list sort, so it is written as a whole sequence rather
	 * than as a single move: a partial reorder is what leaves two zones claiming the same position and
	 * a pick path that depends on the order the database happens to return rows in. The sequence is
	 * therefore validated in full — no position twice, and every named area present at the location —
	 * before the first position is written, so a refused reorder leaves the walking order exactly as
	 * it was.
	 *
	 * @param warehouseId The location.
	 * @param zones The zones and their new positions.
	 * @returns The reordered zones, in their new order.
	 */
	public async reorder(warehouseId: ID, zones: Array<{ id: ID; priority: number }>): Promise<WarehouseZone[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!zones.length) {
			throw new BadRequestException('A reorder must state the position of at least one zone.');
		}

		const positions = new Set<number>();

		for (const zone of zones) {
			if (positions.has(zone.priority)) {
				throw new BadRequestException(
					`Two zones cannot share position ${zone.priority}; the pick path would not be reproducible.`
				);
			}

			positions.add(zone.priority);
		}

		// The whole sequence is resolved before any of it is written, because the refusal that matters
		// here is a statement about a zone rather than about a position: a reorder that names an area
		// which is not there is refused before the first position moves, and never half way through it.
		const resolved: Array<{ id: ID; priority: number; version: number }> = [];

		for (const zone of zones) {
			const existing = await this.typeOrmWarehouseZoneRepository.findOne({
				where: { id: zone.id, tenantId, organizationId, warehouseId }
			});

			if (!existing) {
				throw new NotFoundException(`Zone ${zone.id} was not found at this location.`);
			}

			resolved.push({ id: zone.id, priority: zone.priority, version: (existing.version ?? 1) + 1 });
		}

		for (const zone of resolved) {
			await this.typeOrmWarehouseZoneRepository.update(zone.id, {
				priority: zone.priority,
				version: zone.version
			} as any);
		}

		return await this.findPickPath(warehouseId);
	}

	/**
	 * Deletes a zone that holds no bins.
	 *
	 * A zone with bins is refused rather than emptied: deleting it would take the addresses of the
	 * stock inside it with it, and the operator's problem is the stock, not the row.
	 *
	 * @param id The zone to delete.
	 * @returns The delete result.
	 * @throws BadRequestException with `ZONE_HAS_BINS` when the area still holds positions.
	 */
	public async delete(id: ID): Promise<DeleteResult> {
		const zone = await this.findOneScoped(id);
		const bins = await this.typeOrmWarehouseBinRepository.count({
			where: {
				zoneId: zone.id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (bins > 0) {
			throw new BadRequestException(
				`ZONE_HAS_BINS: the zone still holds ${bins} position(s); move or delete them before deleting the zone.`
			);
		}

		return await super.delete(id);
	}

	/**
	 * Reads a zone.
	 *
	 * @param id The zone to read.
	 * @returns The zone, with its bins.
	 */
	public async findOneDetailed(id: ID): Promise<WarehouseZone> {
		const zone = await this.typeOrmWarehouseZoneRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { bins: true }
		});

		if (!zone) {
			throw new NotFoundException('The zone was not found.');
		}

		return zone;
	}

	/**
	 * Reads a zone inside the caller's tenant and organization.
	 *
	 * @param id The zone to read.
	 * @returns The zone.
	 * @throws NotFoundException when it is not the caller's, which is also what a caller from another
	 * tenant is told — a different answer for "not yours" and "does not exist" leaks the existence of
	 * another tenant's rows.
	 */
	public async findOneScoped(id: ID): Promise<WarehouseZone> {
		const zone = await this.typeOrmWarehouseZoneRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!zone) {
			throw new NotFoundException('The zone was not found.');
		}

		return zone;
	}

	/**
	 * The pick path: the areas of a location that may be picked from, in walking order.
	 *
	 * This is the picking half of the rule resolution. A blocked area is excluded and a
	 * pass-through area is excluded, so what comes back is exactly the set allocation may choose a bin
	 * from.
	 *
	 * @param warehouseId The location.
	 * @returns The eligible areas, visited first to last.
	 */
	public async findPickPath(warehouseId: ID): Promise<WarehouseZone[]> {
		return await this.typeOrmWarehouseZoneRepository.find({
			where: {
				warehouseId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId(),
				isPickable: true,
				isBlocked: false
			},
			order: { priority: 'ASC', code: 'ASC' }
		});
	}

	/**
	 * The put-away path: the areas of a location that may accept goods, in preference order.
	 *
	 * This is the put-away half of the rule resolution, and it is asked with the kind of goods being
	 * put away because a receiving area and a reserve area are both legitimate answers to different
	 * questions.
	 *
	 * @param warehouseId The location.
	 * @param types The area types that may accept the goods; every receivable area when omitted.
	 * @returns The eligible areas, most preferred first.
	 */
	public async findPutAwayPath(warehouseId: ID, types?: WarehouseZoneType[]): Promise<WarehouseZone[]> {
		const zones = await this.typeOrmWarehouseZoneRepository.find({
			where: {
				warehouseId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId(),
				isReceivable: true,
				isBlocked: false
			},
			order: { priority: 'ASC', code: 'ASC' }
		});

		return types?.length ? zones.filter((zone) => types.includes(zone.type)) : zones;
	}

	/**
	 * Asserts that a location can be picked from at all.
	 *
	 * A location that fulfils orders has to have at least one area a pick list may be routed through;
	 * without one every generated list would carry unbinned lines, which is a configuration fault worth
	 * naming at the moment it is configured rather than at the moment somebody tries to ship.
	 *
	 * @param warehouseId The location.
	 * @throws BadRequestException with `WAREHOUSE_NO_PICKING_ZONE` when no area is pickable.
	 */
	public async assertHasPickingZone(warehouseId: ID): Promise<void> {
		const zones = await this.findPickPath(warehouseId);

		if (!zones.length) {
			throw new BadRequestException(
				'WAREHOUSE_NO_PICKING_ZONE: this location has no pickable area, so a pick list cannot be routed through it.'
			);
		}
	}

	/**
	 * @param warehouseId The location.
	 * @param code The code to check.
	 * @throws BadRequestException when the code is already used inside the location.
	 */
	private async assertCodeIsFree(warehouseId: ID, code: string): Promise<void> {
		const existing = await this.typeOrmWarehouseZoneRepository.findOne({
			where: {
				warehouseId,
				code,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (existing) {
			throw new BadRequestException(`The code "${code}" is already used by a zone of this location.`);
		}
	}

	/**
	 * @param warehouseId The location.
	 * @param type The zone type.
	 * @returns The next free position in the sequence for that type.
	 */
	private async nextPriority(warehouseId: ID, type: WarehouseZoneType): Promise<number> {
		const zones = await this.typeOrmWarehouseZoneRepository.find({
			where: {
				warehouseId,
				type,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { priority: 'DESC' },
			take: 1
		});

		return zones.length ? (zones[0].priority ?? 0) + 1 : 0;
	}

	/**
	 * @param min The stated lower bound, when one was.
	 * @param max The stated upper bound, when one was.
	 * @throws BadRequestException when the bounds are not a window.
	 */
	private assertTemperatureWindow(min?: string, max?: string): void {
		if (min === undefined || min === null || min === '' || max === undefined || max === null || max === '') {
			return;
		}

		if (toQuantityUnits(min) > toQuantityUnits(max)) {
			throw new BadRequestException(
				`The lower temperature bound ${min} is above the upper bound ${max}, which is not a window.`
			);
		}
	}
}

/**
 * @param type The zone type.
 * @returns Whether a bin in an area of that type may be picked from by default.
 */
function defaultPickable(type: WarehouseZoneType): boolean {
	return [WarehouseZoneType.PICKING, WarehouseZoneType.STORAGE, WarehouseZoneType.RETURNS].includes(type);
}

/**
 * @param type The zone type.
 * @returns Whether an area of that type accepts goods by default.
 */
function defaultReceivable(type: WarehouseZoneType): boolean {
	return [WarehouseZoneType.RECEIVING, WarehouseZoneType.STORAGE, WarehouseZoneType.RETURNS].includes(type);
}
