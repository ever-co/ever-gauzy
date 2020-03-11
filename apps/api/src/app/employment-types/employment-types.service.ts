import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { EmploymentTypes } from './employment-types.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmploymentTypesCreateInput } from '@gauzy/models';

@Injectable()
export class EmploymentTypesService extends CrudService<EmploymentTypes> {
	employmentTypes: EmploymentTypesCreateInput[];

	constructor(
		@InjectRepository(EmploymentTypes)
		private readonly empTypesRepo: Repository<EmploymentTypes>
	) {
		super(empTypesRepo);
	}

	async retrieve(orgId: string) {
		this.employmentTypes = await this.empTypesRepo.find({
			where: { organizationId: orgId }
		});
		return this.employmentTypes;
	}
}
