import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { SearchIndexDefinition } from '../search-index-definition.entity';

/**
 * The MikroORM side of the index-definition table.
 */
export class MikroOrmSearchIndexDefinitionRepository extends MikroOrmBaseEntityRepository<SearchIndexDefinition> {}
