import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { Unit } from './unit.entity';
import { QuantityCodec, quantise } from './quantity.codec';
import { TypeOrmUnitRepository } from './repository/type-orm-unit.repository';
import { MikroOrmUnitRepository } from './repository/mikro-orm-unit.repository';

/**
 * Manages the units inside a family, and performs the one conversion the platform allows.
 *
 * Conversion is valid only inside one family, and the check is an **equality of `categoryId`**, never
 * a test on the unit: a unit is convertible with its siblings and with nothing else, whatever its
 * factor looks like next to another family's. The check lives here rather than in a constraint because
 * it compares a column of one row with a column of another, which a `CHECK` cannot express — the
 * schema chapter names it `UNIT_CATEGORY_MISMATCH` and the nightly measurement audit re-reports it.
 *
 * Two further rules of the same shape are enforced on write. A variant's `stockUnitId` must be its
 * family's **reference** unit (`STOCK_UNIT_NOT_REFERENCE`), which is what keeps the stock ledger's sum
 * additive: one number per level, in one unit, for ever. And a family referenced by a unit is
 * archived rather than deleted, because every quantity expressed in it would otherwise lose the thing
 * that says what it means.
 */
@Injectable()
export class UnitService extends TenantAwareCrudService<Unit> {
	constructor(
		readonly typeOrmUnitRepository: TypeOrmUnitRepository,
		readonly mikroOrmUnitRepository: MikroOrmUnitRepository
	) {
		super(typeOrmUnitRepository, mikroOrmUnitRepository);
	}

	/**
	 * Reads a unit of the caller's organization.
	 *
	 * @param id The unit id.
	 * @returns The unit.
	 * @throws NotFoundException when this organization has no such unit.
	 */
	async getUnit(id: ID): Promise<Unit> {
		const unit = await this.findOneByWhereOptions({
			id,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);

		if (!unit) {
			throw new NotFoundException('UNIT_NOT_FOUND: the unit does not exist.');
		}

		return unit;
	}

	/**
	 * Lists the units of one family.
	 *
	 * @param categoryId The family id.
	 * @returns The units, ordered by factor so the coarsest is last.
	 */
	async listByCategory(categoryId: ID): Promise<Unit[]> {
		return this.find({
			where: {
				categoryId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { factor: 'ASC' }
		} as any);
	}

	/**
	 * The one unit of a family that defines its base quantity.
	 *
	 * @param categoryId The family id.
	 * @returns The reference unit.
	 * @throws NotFoundException when the family declares none, which a create path never produces.
	 */
	async getReferenceUnit(categoryId: ID): Promise<Unit> {
		const reference = await this.findOneByWhereOptions({
			categoryId,
			isReference: true,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);

		if (!reference) {
			throw new NotFoundException(
				'UNIT_CATEGORY_NO_REFERENCE: the measurement family declares no reference unit.'
			);
		}

		return reference;
	}

	/**
	 * Converts a quantity from one unit to another.
	 *
	 * The multiplication and the division happen once, in `QuantityCodec`, on exact decimals: a factor
	 * is never itself rounded and a float never appears on the path. The result is quantised at the
	 * target unit's granularity, which is the only place a quantity crosses a boundary.
	 *
	 * @param value The exact quantity, expressed in `fromUnitId`.
	 * @param fromUnitId The unit the value is expressed in.
	 * @param toUnitId The unit the value is wanted in.
	 * @returns The quantity in `toUnitId`, as an exact decimal string.
	 * @throws BadRequestException `UNIT_CATEGORY_MISMATCH` when the two units measure different things.
	 * @throws NotFoundException when either unit does not exist for this organization.
	 */
	async convert(value: DecimalString | number, fromUnitId: ID, toUnitId: ID): Promise<DecimalString> {
		if (fromUnitId === toUnitId) {
			return quantise(value, (await this.getUnit(fromUnitId)).decimalPlaces);
		}

		const [from, to] = await Promise.all([this.getUnit(fromUnitId), this.getUnit(toUnitId)]);

		if (from.categoryId !== to.categoryId) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIT_CATEGORY_MISMATCH}: ${from.code} and ${to.code} belong to different measurement families, and conversion is defined only inside one.`
			);
		}

		return QuantityCodec.convert(value, from, to);
	}

	/**
	 * Expresses a quantity in its family's reference unit.
	 *
	 * This is the direction a movement write uses: a document line states the unit it was entered in,
	 * and the ledger holds one number per level in the reference unit of that level's family.
	 *
	 * @param value The exact quantity, expressed in `fromUnitId`.
	 * @param fromUnitId The unit the value is expressed in.
	 * @returns The quantity in the family's reference unit.
	 * @throws BadRequestException `UNIT_CATEGORY_MISMATCH` when the unit has no family locally.
	 * @throws NotFoundException when the unit does not exist for this organization.
	 */
	async toReferenceUnit(value: DecimalString | number, fromUnitId: ID): Promise<DecimalString> {
		const from = await this.getUnit(fromUnitId);
		const reference = await this.getReferenceUnit(from.categoryId);

		return QuantityCodec.toReference(value, from, reference);
	}

	/**
	 * Asserts that a unit a variant claims as its stock unit is its family's reference.
	 *
	 * The rule is what makes `Σ stock_movement.quantity = level.quantity` an arithmetic statement
	 * rather than a comparison of two numbers that may mean different amounts of goods, so it is
	 * checked whenever a variant's stock unit is set. It is a service check and not a constraint
	 * because it compares a column of the variant row with a column of a unit row.
	 *
	 * @param stockUnitId The unit the variant claims.
	 * @returns The unit, once it is known to be a reference.
	 * @throws BadRequestException `STOCK_UNIT_NOT_REFERENCE` when it is not.
	 */
	async assertReferenceUnit(stockUnitId: ID): Promise<Unit> {
		const unit = await this.getUnit(stockUnitId);

		if (!unit.isReference) {
			throw new BadRequestException(
				`${ApiErrorCode.STOCK_UNIT_NOT_REFERENCE}: ${unit.code} is not the reference unit of its family, and a stock level is counted in the reference unit.`
			);
		}

		return unit;
	}

	/**
	 * Asserts that a sales or purchase unit shares the stock unit's family.
	 *
	 * @param stockUnitId The variant's stock unit.
	 * @param otherUnitId The sales or purchase unit it is being set to, when it is being set.
	 * @throws BadRequestException `UNIT_CATEGORY_MISMATCH` when the two measure different things.
	 */
	async assertSameCategory(stockUnitId: ID, otherUnitId?: ID | null): Promise<void> {
		if (!otherUnitId) {
			return;
		}

		const [stock, other] = await Promise.all([this.getUnit(stockUnitId), this.getUnit(otherUnitId)]);

		if (stock.categoryId !== other.categoryId) {
			throw new BadRequestException(
				`${ApiErrorCode.UNIT_CATEGORY_MISMATCH}: ${other.code} does not belong to the same measurement family as ${stock.code}.`
			);
		}
	}

	/**
	 * The unit a quantity is expressed in when the caller did not state one: the family's reference.
	 *
	 * @param categoryId The family id.
	 * @returns The reference unit.
	 */
	async defaultUnitForCategory(categoryId: ID): Promise<Unit> {
		return this.getReferenceUnit(categoryId);
	}
}
