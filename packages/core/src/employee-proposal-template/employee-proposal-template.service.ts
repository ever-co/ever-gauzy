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

	async makeDefault(id: string): Promise<IEmployeeProposalTemplate> {
		const proposalTemplate: IEmployeeProposalTemplate = await this.employeeProposalTemplateRepository.findOneBy({
			id
		});
		proposalTemplate.isDefault = true;

		await this.employeeProposalTemplateRepository.update(
			{
				employeeId: proposalTemplate.employeeId
			},
			{
				isDefault: false
			}
		);

		await this.employeeProposalTemplateRepository.save(proposalTemplate);
		return proposalTemplate;
	}
}
