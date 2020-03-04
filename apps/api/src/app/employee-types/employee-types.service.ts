import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { EmployeeTypes } from './employee-types.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmployeeTypesService extends CrudService<EmployeeTypes> {
	constructor(
		@InjectRepository(EmployeeTypes)
		private readonly empTypesRepo: Repository<EmployeeTypes>
	) {
		super(empTypesRepo);
	}

	retrieve(orgId: string) {
		return this.empTypesRepo.find({ where: { organizationId: orgId } });
	}
}
