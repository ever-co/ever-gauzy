import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmployeeProposalTemplate } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';

@Injectable()
export class EmployeeProposalTemplateService extends TenantAwareCrudService<EmployeeProposalTemplate> {
	constructor(
		@InjectRepository(EmployeeProposalTemplate)
		private readonly employeeProposalTemplateRepository: Repository<EmployeeProposalTemplate>,
		@MikroInjectRepository(EmployeeProposalTemplate)
		private readonly mikroEmployeeProposalTemplateRepository: EntityRepository<EmployeeProposalTemplate>
	) {
		super(employeeProposalTemplateRepository, mikroEmployeeProposalTemplateRepository);
	}

	async makeDefault(
		id: IEmployeeProposalTemplate['id']
	): Promise<IEmployeeProposalTemplate> {
		const proposalTemplate: IEmployeeProposalTemplate = await this.findOneByIdString(id);
		proposalTemplate.isDefault = !proposalTemplate.isDefault;

		const { organizationId, tenantId, employeeId } = proposalTemplate;
		await this.employeeProposalTemplateRepository.update(
			{
				organizationId,
				tenantId,
				employeeId
			},
			{
				isDefault: false
			}
		);

		return await this.employeeProposalTemplateRepository.save(proposalTemplate);
	}

	/**
	 * Finds proposal templates entities that match given find options.
	 *
	 * @param params
	 * @returns
	 */
	async findAll(params?: PaginationParams<IEmployeeProposalTemplate>) {
		return await super.findAll(params);
	}
}
