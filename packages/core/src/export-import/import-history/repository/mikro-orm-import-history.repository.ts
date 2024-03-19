import { EntityRepository } from '@mikro-orm/knex';
import { ImportHistory } from '../import-history.entity';

export class MikroOrmImportHistoryRepository extends EntityRepository<ImportHistory> { }
