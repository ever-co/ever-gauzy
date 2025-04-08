import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginVersion } from '../entities/plugin-version.entity';

export class MikroOrmPluginVersionRepository extends MikroOrmBaseEntityRepository<PluginVersion> {}
