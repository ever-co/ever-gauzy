import { Repository } from 'typeorm';
import { PluginCategory } from '../entities/plugin-category.entity';

export class TypeOrmPluginCategoryRepository extends Repository<PluginCategory> {}
