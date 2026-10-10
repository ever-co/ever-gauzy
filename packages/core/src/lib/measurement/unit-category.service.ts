import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, JsonData } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { UnitCategory } from './unit-category.entity';
import { Unit } from './unit.entity';
import { TypeOrmUnitCategoryRepository } from './repository/type-orm-unit-category.repository';
import { MikroOrmUnitCategoryRepository } from './repository/mikro-orm-unit-category.repository';

/**
 * Manages the families of measurement and the reference unit each one defines.
 *
 * A family exists because conversion is defined only inside one: without it, any two numbers can be
 * added and a stock ledger's sum is unfalsifiable. That is why creating a family and creating its
 * reference unit are one operation rather than two — a family with no reference has no base quantity,
 * so every quantity expressed in it would be a number with no meaning, and the create path refuses
 * that state with `UNIT_CATEGORY_NO_REFERENCE` instead of leaving it to be discovered later.
 *
 * Editing is deliberately unrestricted, including for a seeded family: `isSystem` protects a family
 * from deletion, not from correction. What a tenant chooses is not *whether* units exist but *how many
 * it declares*, which is data and not a switch.
 */
@Injectable()
export class UnitCategoryService extends TenantAwareCrudService<UnitCategory> {
	constructor(
		readonly typeOrmUnitCategoryRepository: TypeOrmUnitCategoryRepository,
		readonly mikroOrmUnitCategoryRepository: MikroOrmUnitCategoryRepository
	) {
		super(typeOrmUnitCategoryRepository, mikroOrmUnitCategoryRepository);
	}

	/**
	 * Reads a family of the caller's organization.
	 *
	 * @param id The family id.
	 * @returns The family.
	 * @throws NotFoundException when this organization has no such family.
	 */
	async getCategory(id: ID): Promise<UnitCategory> {
		const category = await this.findOneByWhereOptions({
			id,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);

		if (!category) {
			throw new NotFoundException('UNIT_CATEGORY_NOT_FOUND: the measurement family does not exist.');
		}

		return category;
	}

	/**
	 * Reads a family by its machine key.
	 *
	 * @param code The family code, for example `COUNT`.
	 * @returns The family, or null when this organization has none with that code.
	 */
	async getCategoryByCode(code: string): Promise<UnitCategory | null> {
		return this.findOneByWhereOptions({
			code,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);
	}

	/**
	 * Creates a family together with its reference unit, in one transaction.
	 *
	 * @param input The family and the reference unit that defines it.
	 * @returns The stored family.
	 * @throws BadRequestException when the reference unit is missing or malformed.
	 * @throws ConflictException-shaped `BadRequestException` when the code is already taken.
	 */
	async createCategoryWithReference(input: {
		code: string;
		name: string;
		isSystem?: boolean;
		metadata?: JsonData;
		reference: {
			code: string;
			name: string;
			symbol?: string;
			decimalPlaces?: number;
		};
	}): Promise<UnitCategory> {
		if (!input?.reference?.code || !input?.reference?.name) {
			throw new BadRequestException(
				'UNIT_CATEGORY_NO_REFERENCE: a measurement family is created with the reference unit that defines it.'
			);
		}

		const existing = await this.getCategoryByCode(input.code);

		if (existing) {
			throw new BadRequestException(
				`UNIT_CATEGORY_CODE_TAKEN: this organization already declares the family "${input.code}".`
			);
		}

		return this.typeOrmRepository.manager.transaction(async (manager) => {
			const tenantId = RequestContext.currentTenantId();
			const organizationId = RequestContext.currentOrganizationId();

			const category = manager.create(UnitCategory, {
				code: input.code,
				name: input.name,
				isSystem: input.isSystem ?? false,
				metadata: input.metadata,
				tenantId,
				organizationId
			} as Partial<UnitCategory>);

			const stored = await manager.save(category);

			// The reference unit is created inside the same transaction as its family, because a family
			// without a reference is a family in which no quantity means anything.
			const reference = manager.create(Unit, {
				categoryId: stored.id,
				code: input.reference.code,
				name: input.reference.name,
				symbol: input.reference.symbol,
				factor: '1',
				isReference: true,
				decimalPlaces: input.reference.decimalPlaces ?? 0,
				isSystem: input.isSystem ?? false,
				tenantId,
				organizationId
			} as Partial<Unit>);

			await manager.save(reference);

			return stored;
		});
	}
}
