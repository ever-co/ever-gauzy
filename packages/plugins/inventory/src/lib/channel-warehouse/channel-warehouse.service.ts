import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, Warehouse } from '@gauzy/core';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { ChannelWarehouse } from './channel-warehouse.entity';
import { TypeOrmChannelWarehouseRepository } from './repository/type-orm-channel-warehouse.repository';
import { MikroOrmChannelWarehouseRepository } from './repository/mikro-orm-channel-warehouse.repository';

/**
 * Maintains which locations a sales context may draw on.
 *
 * The open-by-default rule lives here: a context with no assignment rows is not restricted, and the
 * moment one row exists the context is restricted to the locations it names. Assignment is therefore
 * an opt-in switch rather than a configuration every installation must complete.
 */
@Injectable()
export class ChannelWarehouseService extends TenantAwareCrudService<ChannelWarehouse> {
	constructor(
		readonly typeOrmChannelWarehouseRepository: TypeOrmChannelWarehouseRepository,
		readonly mikroOrmChannelWarehouseRepository: MikroOrmChannelWarehouseRepository
	) {
		super(typeOrmChannelWarehouseRepository, mikroOrmChannelWarehouseRepository);
	}

	/** Lists assignments. */
	public async findAssignments(filter?: FindManyOptions<ChannelWarehouse>): Promise<IPagination<ChannelWarehouse>> {
		return await this.paginate(filter ?? {});
	}

	/**
	 * Assigns a location to a context.
	 *
	 * Marking the assignment as the context’s default demotes whichever assignment held that role,
	 * inside the same transaction, so the rule is never observably broken — not even between the two
	 * statements a naive implementation would need.
	 */
	public async assign(input: {
		channelId: ID;
		warehouseId: ID;
		isDefault?: boolean;
		priority?: number;
		metadata?: Record<string, any>;
	}): Promise<ChannelWarehouse> {
		return await this.typeOrmChannelWarehouseRepository.manager.transaction(async (manager) => {
			await this.assertWarehouse(manager, input.warehouseId);

			const existing = await manager.findOne(ChannelWarehouse, {
				where: {
					channelId: input.channelId,
					warehouseId: input.warehouseId,
					tenantId: RequestContext.currentTenantId()
				} as any
			});

			if (input.isDefault) {
				await this.clearExistingDefault(manager, input.channelId, existing?.id);
			}

			if (existing) {
				existing.isDefault = input.isDefault ?? existing.isDefault;
				existing.priority = input.priority ?? existing.priority;
				existing.metadata = input.metadata ?? existing.metadata;
				return await manager.save(ChannelWarehouse, existing);
			}

			const assignment = manager.create(ChannelWarehouse, {
				channelId: input.channelId,
				warehouseId: input.warehouseId,
				isDefault: !!input.isDefault,
				priority: input.priority ?? 0,
				metadata: input.metadata,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as Partial<ChannelWarehouse>);
			return await manager.save(ChannelWarehouse, assignment);
		});
	}

	/** Removes an assignment. */
	public async unassign(channelId: ID, warehouseId: ID): Promise<void> {
		await this.typeOrmChannelWarehouseRepository.delete({ channelId, warehouseId } as any);
	}

	/**
	 * Resolves the locations a context may draw on.
	 *
	 * An empty result means the context is unrestricted and every fulfilment location is eligible;
	 * a caller must therefore treat "no rows" as "all locations", never as "no locations".
	 */
	public async eligibleWarehouseIds(channelId: ID): Promise<{ restricted: boolean; warehouseIds: ID[] }> {
		const rows = await this.typeOrmChannelWarehouseRepository.find({
			where: { channelId, tenantId: RequestContext.currentTenantId() } as any,
			order: { priority: 'DESC' } as any
		});
		return {
			restricted: rows.length > 0,
			warehouseIds: rows.map((row) => row.warehouseId)
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/** Refuses an assignment to a location that does not exist in this tenant. */
	private async assertWarehouse(manager: any, warehouseId: ID): Promise<void> {
		const warehouse = await manager.findOne(Warehouse, {
			where: { id: warehouseId, tenantId: RequestContext.currentTenantId() } as any
		});
		if (!warehouse) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The location does not exist.', {
				notFound: true,
				details: { warehouseId }
			});
		}
	}

	/**
	 * Demotes the context’s current default assignment.
	 *
	 * Done first and inside the transaction, so a unique index over the default column — where the
	 * dialect has one — never sees two defaults and a concurrent assignment cannot interleave.
	 */
	private async clearExistingDefault(manager: any, channelId: ID, keepId?: ID): Promise<void> {
		const current = await manager.find(ChannelWarehouse, {
			where: { channelId, isDefault: true, tenantId: RequestContext.currentTenantId() } as any
		});
		for (const row of current) {
			if (keepId && row.id === keepId) {
				continue;
			}
			row.isDefault = false;
			await manager.save(ChannelWarehouse, row);
		}
		if (current.some((row: ChannelWarehouse) => !keepId || row.id !== keepId)) {
			// The demotion is the fix; nothing was refused. This branch exists so the intent is
			// explicit rather than implied by the loop above.
			return;
		}
	}
}
