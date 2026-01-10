import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginCategory } from '../entities/plugin-category.entity';

export class TypeOrmPluginCategoryRepository extends Repository<PluginCategory> {
	constructor(@InjectRepository(PluginCategory) readonly repository: Repository<PluginCategory>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
