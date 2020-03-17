import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationEmploymentTypeService extends CrudService<
	OrganizationEmploymentType
> {
	constructor(
		@InjectRepository(OrganizationEmploymentType)
		private readonly employmentTypesRepo: Repository<
			OrganizationEmploymentType
		>
	) {
		super(employmentTypesRepo);
	}
}
