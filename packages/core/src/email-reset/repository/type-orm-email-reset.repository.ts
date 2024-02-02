import { Repository } from 'typeorm';
import { EmailReset } from '../email-reset.entity';

export class TypeOrmEmailResetRepository extends Repository<EmailReset> { }