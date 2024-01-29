import { Repository } from 'typeorm';
import { EmailHistory } from '../email-history.entity';

export class TypeOrmEmailHistoryRepository extends Repository<EmailHistory> { }