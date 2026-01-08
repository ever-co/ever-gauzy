import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../system-setting.entity';

@Injectable()
export class TypeOrmSystemSettingRepository extends Repository<SystemSetting> {
	constructor(@InjectRepository(SystemSetting) readonly repository: Repository<SystemSetting>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
