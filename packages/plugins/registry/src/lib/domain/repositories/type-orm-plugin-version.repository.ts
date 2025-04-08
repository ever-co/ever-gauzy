import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginVersion } from '../entities/plugin-version.entity';

@Injectable()
export class TypeOrmPluginVersionRepository extends Repository<PluginVersion> {
	constructor(@InjectRepository(PluginVersion) readonly repository: Repository<PluginVersion>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
