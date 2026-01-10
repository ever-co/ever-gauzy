import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginSetting } from '../entities/plugin-setting.entity';

@Injectable()
export class TypeOrmPluginSettingRepository extends Repository<PluginSetting> {
	constructor(@InjectRepository(PluginSetting) readonly repository: Repository<PluginSetting>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
