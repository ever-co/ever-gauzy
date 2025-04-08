import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginSource } from '../entities/plugin-source.entity';

export class MikroOrmPluginSourceRepository extends MikroOrmBaseEntityRepository<PluginSource> {}
