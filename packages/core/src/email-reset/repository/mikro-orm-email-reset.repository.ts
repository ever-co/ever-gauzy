import { EntityRepository } from '@mikro-orm/knex';
import { EmailReset } from '../email-reset.entity';

export class MikroOrmEmailResetRepository extends EntityRepository<EmailReset> { }
