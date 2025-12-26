import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginTenant } from '../../entities/plugin-tenant.entity';

@Injectable()
export class TypeOrmPluginTenantRepository extends Repository<PluginTenant> {
	constructor(@InjectRepository(PluginTenant) readonly repository: Repository<PluginTenant>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
