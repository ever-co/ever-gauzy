import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginSource } from '../entities/plugin-source.entity';

@Injectable()
export class TypeOrmPluginSourceRepository extends Repository<PluginSource> {
	constructor(@InjectRepository(PluginSource) readonly repository: Repository<PluginSource>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
