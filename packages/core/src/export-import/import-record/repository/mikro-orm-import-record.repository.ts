import { EntityRepository } from '@mikro-orm/core';
import { ImportRecord } from '../import-record.entity';

export class MikroOrmImportRecordRepository extends EntityRepository<ImportRecord> { }