import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, DeleteResult, FindManyOptions, FindOptionsWhere } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TaxWriteInput } from '../tax.types';
import { TaxCategory } from './tax-category.entity';
import { MikroOrmTaxCategoryRepository } from './repository/mikro-orm-tax-category.repository';
import { TypeOrmTaxCategoryRepository } from './repository/type-orm-tax-category.repository';

/**
 * The categories an organization taxes under.
 *
 * The service owns the two invariants a category has: its code is unique inside the organization, and
 * exactly one category per organization is the default. Both are enforced here and not only by the
 * partial unique indexes, because MySQL cannot express a filtered index — the index is the backstop on
 * the dialects that can, and this service is the rule everywhere.
 *
 * A category is never hard-deleted through the API. A hard delete would cascade into its rates through
 * the foreign key, and the rates are what already placed tax lines point at, so the row is soft-deleted
 * and kept.
 */
@Injectable()
export class TaxCategoryService extends TenantAwareCrudService<TaxCategory> {
	constructor(
		readonly typeOrmTaxCategoryRepository: TypeOrmTaxCategoryRepository,
		readonly mikroOrmTaxCategoryRepository: MikroOrmTaxCategoryRepository
	) {
		super(typeOrmTaxCategoryRepository, mikroOrmTaxCategoryRepository);
	}

	/**
	 * Retrieves a paginated list of tax categories.
	 *
	 * @param filter Optional filtering criteria.
	 * @returns A paginated list of categories.
	 */
	public async findAll(filter?: FindManyOptions<TaxCategory>): Promise<IPagination<TaxCategory>> {
		return await this.paginate(filter);
	}

	/**
	 * Creates a category for the caller's organization.
	 *
	 * @param entity The category to create.
	 * @returns The persisted category.
	 * @throws BadRequestException when the organization cannot be resolved, when the code is missing or
	 * already taken in that organization.
	 */
	public async create(entity: TaxWriteInput<TaxCategory>): Promise<TaxCategory> {
		const organizationId = this.resolveOrganizationId(entity);
		const code = this.assertCode(entity.code);

		// A code nobody holds yet is the ordinary case for a creation, so the read has to be able to
		// answer "this organization holds none" instead of raising: a throwing read would refuse every
		// category whose code is free, which is the only category a create call is for.
		if (await this.findByCode(code, organizationId)) {
			throw new BadRequestException(`A tax category with the code "${code}" already exists in this organization.`);
		}

		// One default per organization: the new default replaces the current one rather than competing with it.
		if (entity.isDefault) {
			await this.clearDefault(organizationId);
		}

		return await super.create({ ...entity, code, organizationId } as DeepPartial<TaxCategory>);
	}

	/**
	 * Updates a category of the caller's organization.
	 *
	 * @param id The category to update.
	 * @param entity The members to change.
	 * @returns The updated category.
	 * @throws NotFoundException when the category does not exist in the caller's tenant.
	 * @throws BadRequestException when the new code is already taken in the organization.
	 */
	public async update(id: ID, entity: TaxWriteInput<TaxCategory>): Promise<TaxCategory> {
		const category = await this.findOneByIdString(id);
		if (!category) {
			throw new NotFoundException(`The tax category ${id} was not found.`);
		}

		const organizationId = category.organizationId ?? this.resolveOrganizationId(entity);
		const code = entity.code === undefined ? undefined : this.assertCode(entity.code);

		if (code && code !== category.code) {
			const duplicate = await this.findByCode(code, organizationId);
			if (duplicate && duplicate.id !== id) {
				throw new BadRequestException(
					`A tax category with the code "${code}" already exists in this organization.`
				);
			}
		}

		if (entity.isDefault === true && category.isDefault !== true) {
			await this.clearDefault(organizationId, id);
		}

		await super.update(id, { ...entity, ...(code ? { code } : {}) } as DeepPartial<TaxCategory>);

		// The row is read back rather than returned from the update, because the two ORMs answer an
		// update differently and the caller of an update wants the record, not the driver's result.
		return await this.findOneByIdString(id);
	}

	/**
	 * Retires a category instead of removing its row.
	 *
	 * The row is soft-deleted because a hard delete cascades into the category's rates, and a tax line
	 * that was already written points at the rate it was charged at. The rates themselves stay readable
	 * through their own endpoints, and the category can be restored with the platform's recover route.
	 *
	 * @param criteria The category to retire, by id or by conditions.
	 * @returns The delete result, so the route keeps the platform's response shape.
	 */
	public async delete(criteria: string | FindOptionsWhere<TaxCategory>): Promise<DeleteResult> {
		await super.softDelete(criteria);
		return { affected: 1, raw: [] } as DeleteResult;
	}

	/**
	 * The organization's default category, which is what a variant or a party that names no category is
	 * taxed under.
	 *
	 * @param organizationId The organization; the caller's organization when it is omitted.
	 * @returns The default category, or null when the organization has not declared one.
	 */
	public async findDefault(organizationId?: ID): Promise<TaxCategory | null> {
		return await this.findOneByWhereOptions({
			isDefault: true,
			...(organizationId ? { organizationId } : {})
		} as FindOptionsWhere<TaxCategory>);
	}

	/**
	 * The category an organization holds under a code.
	 *
	 * **A free code is an answer, not a refusal.** The read is the fail-soft half of the pair —
	 * `findOneOrFailByWhereOptions`, whose `ITryRequest` carries `success: false` instead of raising —
	 * because the uniqueness rule asks whether the code is *taken*, and an accountant can only populate
	 * the taxonomy if the read that clears a free code answers rather than throws.
	 *
	 * @param code The code to look up, as {@link assertCode} trimmed it.
	 * @param organizationId The organization the code has to be held inside.
	 * @returns The category, or null when the organization holds none under that code.
	 */
	private async findByCode(code: string, organizationId: ID): Promise<TaxCategory | null> {
		const outcome = await this.findOneOrFailByWhereOptions({
			code,
			organizationId
		} as FindOptionsWhere<TaxCategory>);

		return outcome.success ? (outcome.record as TaxCategory) : null;
	}

	/**
	 * Turns every other default of the organization off, so that the one-default rule holds no matter
	 * which row declared itself last.
	 *
	 * @param organizationId The organization whose default is being replaced.
	 * @param keepId The category that is becoming the default, when one already exists.
	 */
	private async clearDefault(organizationId: ID, keepId?: ID): Promise<void> {
		const current = await this.find({
			where: { isDefault: true, organizationId } as FindOptionsWhere<TaxCategory>
		});

		for (const category of current) {
			if (keepId && category.id === keepId) {
				continue;
			}
			await super.update(category.id, { isDefault: false } as DeepPartial<TaxCategory>);
		}
	}

	/**
	 * @param entity The payload the caller supplied.
	 * @returns The organization the category belongs to.
	 * @throws BadRequestException when neither the request context nor the payload names one.
	 */
	private resolveOrganizationId(entity: TaxWriteInput<TaxCategory>): ID {
		const organizationId = RequestContext.currentOrganizationId() ?? entity?.organizationId;
		if (!organizationId) {
			throw new BadRequestException(
				'A tax category belongs to an organization, and none was resolved for this request.'
			);
		}

		return organizationId;
	}

	/**
	 * @param code The code the caller supplied.
	 * @returns The trimmed code.
	 * @throws BadRequestException when it is missing.
	 */
	private assertCode(code?: string): string {
		const trimmed = typeof code === 'string' ? code.trim() : '';
		if (!trimmed) {
			throw new BadRequestException('A tax category needs a code, for example "STANDARD".');
		}

		return trimmed;
	}
}
