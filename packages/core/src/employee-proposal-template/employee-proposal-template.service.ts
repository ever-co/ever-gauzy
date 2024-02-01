import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IEmployeeProposalTemplate } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { TypeOrmEmployeeProposalTemplateRepository } from './repository/type-orm-employee-proposal-template.repository';
import { MikroOrmEmployeeProposalTemplateRepository } from './repository/mikro-orm-employee-proposal-template.repository';

@Injectable()
export class EmployeeProposalTemplateService extends TenantAwareCrudService<EmployeeProposalTemplate> {
	constructor(
		@InjectRepository(EmployeeProposalTemplate)
		typeOrmEmployeeProposalTemplateRepository: TypeOrmEmployeeProposalTemplateRepository,

		mikroOrmEmployeeProposalTemplateRepository: MikroOrmEmployeeProposalTemplateRepository
	) {
		super(typeOrmEmployeeProposalTemplateRepository, mikroOrmEmployeeProposalTemplateRepository);
	}

	/**
	 *
	 * @param id
	 * @returns
	 */
	async makeDefault(id: IEmployeeProposalTemplate['id']): Promise<IEmployeeProposalTemplate> {
		const proposalTemplate: IEmployeeProposalTemplate = await this.findOneByIdString(id);
		proposalTemplate.isDefault = !proposalTemplate.isDefault;

		const { organizationId, tenantId, employeeId } = proposalTemplate;

		await super.update({ organizationId, tenantId, employeeId }, {
			isDefault: false
		});

		return await super.save(proposalTemplate);
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
