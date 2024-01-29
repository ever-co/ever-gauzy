import { Repository } from 'typeorm';
import { ImportHistory } from '../import-history.entity';

export class TypeOrmImportHistoryRepository extends Repository<ImportHistory> { }