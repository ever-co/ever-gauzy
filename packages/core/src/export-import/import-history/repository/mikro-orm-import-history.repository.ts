import { EntityRepository } from '@mikro-orm/core';
import { ImportHistory } from '../import-history.entity';

export class MikroOrmImportHistoryRepository extends EntityRepository<ImportHistory> { }