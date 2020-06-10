import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationAwards } from './organization-awards.entity';

@Injectable()
export class OrganizationAwardsService extends CrudService<OrganizationAwards> {
	constructor(
		@InjectRepository(OrganizationAwards)
		private readonly organizationAwardsRepository: Repository<
			OrganizationAwards
		>
	) {
		super(organizationAwardsRepository);
	}
}
