import { EntityRepository } from '@mikro-orm/knex';
import { ImportRecord } from '../import-record.entity';

export class MikroOrmImportRecordRepository extends EntityRepository<ImportRecord> { }
