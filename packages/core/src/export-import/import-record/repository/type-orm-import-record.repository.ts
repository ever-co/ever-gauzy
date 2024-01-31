import { Repository } from 'typeorm';
import { ImportRecord } from '../import-record.entity';

export class TypeOrmImportRecordRepository extends Repository<ImportRecord> { }