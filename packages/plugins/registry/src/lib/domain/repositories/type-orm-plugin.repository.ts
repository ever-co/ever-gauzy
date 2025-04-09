import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin } from '../entities/plugin.entity';

@Injectable()
export class TypeOrmPluginRepository extends Repository<Plugin> {
	constructor(@InjectRepository(Plugin) readonly repository: Repository<Plugin>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
