import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { SearchDocument } from '../search-document.entity';

/**
 * The MikroORM side of the search-document table.
 */
export class MikroOrmSearchDocumentRepository extends MikroOrmBaseEntityRepository<SearchDocument> {}
