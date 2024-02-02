import { EntityRepository } from '@mikro-orm/core';
import { EmailHistory } from '../email-history.entity';

export class MikroOrmEmailHistoryRepository extends EntityRepository<EmailHistory> { }