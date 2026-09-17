import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, WarehouseProductVariant } from '@gauzy/core';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { StockAlert } from './stock-alert.entity';
import { TypeOrmStockAlertRepository } from './repository/type-orm-stock-alert.repository';
import { MikroOrmStockAlertRepository } from './repository/mikro-orm-stock-alert.repository';

/** What one evaluation pass found. */
export interface IStockAlertEvaluation {
	readonly evaluated: number;
	readonly fired: Array<{ alertId: ID; variantId: ID; warehouseId?: ID; availability: number; threshold: number }>;
	readonly suppressed: number;
}

/**
 * Maintains the low-stock rules and evaluates them.
 *
 * The scan is deliberately not a job declared here: the platform scheduler owns cadence, and this
 * service exposes the evaluation so the job body is one call. Evaluation never writes stock — an
 * alert is a notification, and a notification must never be able to change a level.
 */
@Injectable()
export class StockAlertService extends TenantAwareCrudService<StockAlert> {
	constructor(
		readonly typeOrmStockAlertRepository: TypeOrmStockAlertRepository,
		readonly mikroOrmStockAlertRepository: MikroOrmStockAlertRepository
	) {
		super(typeOrmStockAlertRepository, mikroOrmStockAlertRepository);
	}

	/** Lists alert rules. */
	public async findAlerts(filter?: FindManyOptions<StockAlert>): Promise<IPagination<StockAlert>> {
		return await this.paginate(filter ?? {});
	}

	/**
	 * Creates a rule, refusing a second rule for the same variant and location.
	 *
	 * The database states the same rule as a unique index; the service states it first so the caller
	 * gets a named refusal instead of a constraint violation.
	 */
	public async createAlert(input: Partial<StockAlert>): Promise<StockAlert> {
		const existing = await this.typeOrmStockAlertRepository.findOne({
			where: {
				variantId: input.variantId,
				warehouseId: (input.warehouseId ?? null) as any,
				tenantId: RequestContext.currentTenantId()
			} as any
		});
		if (existing) {
			throw inventoryError(
				InventoryErrorCode.ALERT_ALREADY_EXISTS,
				'An alert rule already watches this variant at this location.',
				{ details: { alertId: existing.id } }
			);
		}
		return await this.create(input);
	}

	/**
	 * Evaluates every enabled rule of the organization.
	 *
	 * A rule whose last fire is inside its cooling-off period is skipped rather than re-sent, and a
	 * rule that fires records when it did, so the next pass can honour the cooldown.
	 *
	 * @param now the reference moment, supplied by the job and by tests.
	 */
	public async evaluate(now: Date = new Date()): Promise<IStockAlertEvaluation> {
		const tenantId = RequestContext.currentTenantId();
		const rules = await this.typeOrmStockAlertRepository.find({
			where: { isActive: true, ...(tenantId ? { tenantId } : {}) } as any
		});

		const fired: IStockAlertEvaluation['fired'] = [];
		let suppressed = 0;

		for (const rule of rules) {
			if (rule.lastTriggeredAt && rule.cooldownMinutes > 0) {
				const nextAllowed = new Date(rule.lastTriggeredAt).getTime() + rule.cooldownMinutes * 60 * 1000;
				if (nextAllowed > now.getTime()) {
					suppressed += 1;
					continue;
				}
			}

			const availability = await this.availabilityOf(rule.variantId, rule.warehouseId);
			if (availability === null || availability > Number(rule.threshold)) {
				continue;
			}

			rule.lastTriggeredAt = now;
			await this.typeOrmStockAlertRepository.save(rule);
			fired.push({
				alertId: rule.id,
				variantId: rule.variantId,
				warehouseId: rule.warehouseId,
				availability,
				threshold: Number(rule.threshold)
			});
		}

		return { evaluated: rules.length, fired, suppressed };
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Availability of the variant at the location, or across every location when none is named.
	 *
	 * Availability is derived, never stored: it is on-hand minus reserved minus the unsellable buffer.
	 */
	private async availabilityOf(variantId: ID, warehouseId?: ID): Promise<number | null> {
		const query = this.typeOrmStockAlertRepository.manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.select('COALESCE(SUM(level.quantity - level.reservedQuantity - level.safetyStock), 0)', 'available')
			.where('level.variantId = :variantId', { variantId });

		if (warehouseId) {
			query.andWhere('aggregate.warehouseId = :warehouseId', { warehouseId });
		}

		const raw = await query.getRawOne();
		return raw ? Number(raw.available ?? 0) : null;
	}
}
