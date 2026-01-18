import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationStrategicInitiative } from '../organization-strategic-initiative.entity';

@Injectable()
export class TypeOrmOrganizationStrategicInitiativeRepository extends Repository<OrganizationStrategicInitiative> {
	constructor(
		@InjectRepository(OrganizationStrategicInitiative) readonly repository: Repository<OrganizationStrategicInitiative>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
