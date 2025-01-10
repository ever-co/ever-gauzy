import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantApiKey } from '../tenant-api-key.entity';

@Injectable()
export class TypeOrmTenantApiKeyRepository extends Repository<TenantApiKey> {
	constructor(@InjectRepository(TenantApiKey) readonly repository: Repository<TenantApiKey>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
