import { Injectable } from '@nestjs/common';
import { ID, IEmployeeProposalTemplate, IEmployeeProposalTemplateMakeDefaultInput } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from '@gauzy/core';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { MikroOrmEmployeeProposalTemplateRepository, TypeOrmEmployeeProposalTemplateRepository } from './repository';

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
	 * @param id - The ID of the proposal template.
	 * @returns The updated proposal template.
	 */
	async makeDefault(id: ID, input: IEmployeeProposalTemplateMakeDefaultInput): Promise<IEmployeeProposalTemplate> {
		const proposalTemplate: IEmployeeProposalTemplate = await this.findOneByIdString(id);
		proposalTemplate.isDefault = input.isDefault;

		const { organizationId, tenantId, employeeId } = proposalTemplate;

		await super.update(
			{ organizationId, tenantId, employeeId },
			{
				isDefault: false
			}
		);

		return await super.save(proposalTemplate);
	}

	/**
	 * Finds proposal templates entities that match given find options.
	 *
	 * @param params - Pagination parameters.
	 * @returns The list of proposal templates.
	 */
	async findAll(params?: PaginationParams<IEmployeeProposalTemplate>) {
		return await super.findAll(params);
	}
}
