import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmployeeProposalTemplate } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';

@Injectable()
export class EmployeeProposalTemplateService extends TenantAwareCrudService<EmployeeProposalTemplate> {
	constructor(
		@InjectRepository(EmployeeProposalTemplate)
		private readonly employeeProposalTemplateRepository: Repository<EmployeeProposalTemplate>
	) {
		super(employeeProposalTemplateRepository);
	}

	async makeDefault(
		id: IEmployeeProposalTemplate['id']
	): Promise<IEmployeeProposalTemplate> {
		const proposalTemplate: IEmployeeProposalTemplate = await this.findOneByIdString(id);
		proposalTemplate.isDefault = true;

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
}
