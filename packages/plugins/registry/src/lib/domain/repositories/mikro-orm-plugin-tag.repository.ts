import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginTag } from '../entities/plugin-tag.entity';

/**
 * MikroORM repository for PluginTag entity.
 *
 * This repository provides MikroORM-specific data access methods for plugin-tag relationships.
 * It extends the base repository to inherit common CRUD operations while allowing for
 * custom query methods specific to plugin-tag associations.
 */
export class MikroOrmPluginTagRepository extends MikroOrmBaseEntityRepository<PluginTag> {}
