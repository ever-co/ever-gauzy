import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrganization } from '../user-organization.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmUserOrganizationRepository extends Repository<UserOrganization> {
	constructor(@InjectRepository(UserOrganization) readonly repository: Repository<UserOrganization>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
