import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';

@Injectable()
export class EmployeeProposalTemplateService extends CrudService<
	EmployeeProposalTemplate
> {
	constructor(
		@InjectRepository(EmployeeProposalTemplate)
		private readonly employeeProposalTemplateRepository: Repository<
			EmployeeProposalTemplate
		>
	) {
		super(employeeProposalTemplateRepository);
	}
}
