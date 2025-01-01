import { Injectable, NotFoundException } from '@nestjs/common';
import { ID, IEmployeeProposalTemplate, IEmployeeProposalTemplateMakeDefaultInput, IPagination } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from '@gauzy/core';
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

		// Update the isDefault property on all templates matching these fields
		await super.update({ organizationId, tenantId, employeeId }, { isDefault: false });

		// Save and return the updated template
		return super.save(proposalTemplate);
	}

	/**
	 * Finds all proposal templates matching the given pagination params.
	 *
	 * @param {PaginationParams<IEmployeeProposalTemplate>} [params] - Pagination parameters.
	 * @returns {Promise<IPagination<IEmployeeProposalTemplate>>} Paginated result.
	 */
	public async findAll(
		params?: PaginationParams<IEmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		// Directly return the result of `super.findAll`.
		return super.findAll(params);
	}
}
