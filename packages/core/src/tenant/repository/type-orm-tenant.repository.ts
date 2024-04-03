import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenant.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmTenantRepository extends Repository<Tenant> {
	constructor(@InjectRepository(Tenant) readonly repository: Repository<Tenant>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
