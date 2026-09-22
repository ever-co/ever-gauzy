import { Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ID,
	IEmployeeProposalTemplate,
	IEmployeeProposalTemplateMakeDefaultInput,
	IPagination
} from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService, sanitizeRichHtml } from '@gauzy/core';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { MikroOrmEmployeeProposalTemplateRepository } from './repository/mikro-orm-employee-proposal-template.repository';
import { TypeOrmEmployeeProposalTemplateRepository } from './repository/type-orm-employee-proposal-template.repository';

@Injectable()
export class EmployeeProposalTemplateService extends TenantAwareCrudService<EmployeeProposalTemplate> {
	constructor(
		readonly typeOrmEmployeeProposalTemplateRepository: TypeOrmEmployeeProposalTemplateRepository,
		readonly mikroOrmEmployeeProposalTemplateRepository: MikroOrmEmployeeProposalTemplateRepository
	) {
		super(typeOrmEmployeeProposalTemplateRepository, mikroOrmEmployeeProposalTemplateRepository);
	}

	/**
	 * Creates a proposal template, sanitizing the rich-text `content` HTML through the shared
	 * server-side allowlist before persisting — the content is re-rendered in template views and
	 * fed into Gauzy AI proposal generation (see `sanitizeRichHtml`).
	 *
	 * @param entity - The proposal template data to persist.
	 * @returns The persisted proposal template.
	 */
	public async create(entity: DeepPartial<EmployeeProposalTemplate>): Promise<EmployeeProposalTemplate> {
		if (typeof entity.content === 'string') {
			entity.content = sanitizeRichHtml(entity.content);
		}
		return await super.create(entity);
	}

	/**
	 * Updates a proposal template, sanitizing the rich-text `content` HTML through the shared
	 * server-side allowlist before persisting (see `create`).
	 *
	 * @param id - The template ID (or where-criteria) to update.
	 * @param partialEntity - The partial update payload.
	 * @returns The updated template or the TypeORM update result.
	 */
	public async update(
		id: string | FindOptionsWhere<EmployeeProposalTemplate>,
		partialEntity: QueryDeepPartialEntity<EmployeeProposalTemplate>
	): Promise<EmployeeProposalTemplate | UpdateResult> {
		const input = partialEntity as { content?: string };
		if (typeof input.content === 'string') {
			input.content = sanitizeRichHtml(input.content);
		}
		return await super.update(id, partialEntity);
	}

	/**
	 * Toggles the default status of a proposal template.
	 *
	 * @param {ID} id - The ID of the proposal template.
	 * @param {IEmployeeProposalTemplateMakeDefaultInput} input - The object containing the `isDefault` value.
	 * @returns {Promise<IEmployeeProposalTemplate>} The updated proposal template.
	 */
	public async makeDefault(
		id: ID,
		input: IEmployeeProposalTemplateMakeDefaultInput
	): Promise<IEmployeeProposalTemplate> {
		const proposalTemplate = await this.findOneByIdString(id);

		if (!proposalTemplate) {
			throw new NotFoundException(`Proposal template with ID ${id} not found`);
		}

		// Update the isDefault property on the target template
		proposalTemplate.isDefault = input.isDefault;

		// Reset `isDefault` to false on all templates matching these fields
		const { organizationId, tenantId, employeeId } = proposalTemplate;

		// Update the isDefault property on all templates matching these fields. organizationId is a
		// nullable column: for an organization-less template the null means `organizationId IS NULL` on
		// both ORMs (TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR), i.e. only its organization-less siblings are
		// reset — the null used to be dropped and reset the employee's templates in every organization.
		await super.update({ organizationId, tenantId, employeeId }, { isDefault: false });

		// Save and return the updated template
		return super.save(proposalTemplate);
	}

	/**
	 * Finds all proposal templates matching the given pagination params.
	 *
	 * @param {BaseQueryDTO<IEmployeeProposalTemplate>} [params] - Pagination parameters.
	 * @returns {Promise<IPagination<IEmployeeProposalTemplate>>} Paginated result.
	 */
	public async findAll(
		params?: BaseQueryDTO<IEmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		// Directly return the result of `super.findAll`.
		return super.findAll(params);
	}
}
