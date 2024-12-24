import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmailHistory } from '../email-history.entity';

export class MikroOrmEmailHistoryRepository extends MikroOrmBaseEntityRepository<EmailHistory> { }
