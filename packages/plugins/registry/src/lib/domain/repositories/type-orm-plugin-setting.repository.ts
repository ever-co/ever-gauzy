import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmBaseEntityRepository } from '@gauzy/core';
import { PluginSetting } from '../entities/plugin-setting.entity';

@Injectable()
export class TypeOrmPluginSettingRepository extends TypeOrmBaseEntityRepository<PluginSetting> {
	constructor(@InjectRepository(PluginSetting) readonly repository: Repository<PluginSetting>) {
		super(repository);
	}
}
