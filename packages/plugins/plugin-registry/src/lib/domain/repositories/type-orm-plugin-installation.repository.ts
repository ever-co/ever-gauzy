import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginInstallation } from '../entities/plugin-installation.entity';

@Injectable()
export class TypeOrmPluginInstallationRepository extends Repository<PluginInstallation> {
	constructor(@InjectRepository(PluginInstallation) readonly repository: Repository<PluginInstallation>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
