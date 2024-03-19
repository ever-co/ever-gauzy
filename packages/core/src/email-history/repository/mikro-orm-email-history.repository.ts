import { EntityRepository } from '@mikro-orm/knex';
import { EmailHistory } from '../email-history.entity';

export class MikroOrmEmailHistoryRepository extends EntityRepository<EmailHistory> { }
