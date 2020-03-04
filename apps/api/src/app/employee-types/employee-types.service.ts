import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { EmployeeTypes } from './employee-types.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeTypesCreateInput } from '@gauzy/models';

@Injectable()
export class EmployeeTypesService extends CrudService<EmployeeTypes> {
	employeeTypes: EmployeeTypesCreateInput[];

	constructor(
		@InjectRepository(EmployeeTypes)
		private readonly empTypesRepo: Repository<EmployeeTypes>
	) {
		super(empTypesRepo);
	}

	async retrieve(orgId: string) {
		this.employeeTypes = await this.empTypesRepo.find({
			where: { organizationId: orgId }
		});
		return this.employeeTypes;
	}
}
