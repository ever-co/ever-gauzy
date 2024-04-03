import { Repository } from 'typeorm';
import { TenantSetting } from '../tenant-setting.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmTenantSettingRepository extends Repository<TenantSetting> {
	constructor(@InjectRepository(TenantSetting) readonly repository: Repository<TenantSetting>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
