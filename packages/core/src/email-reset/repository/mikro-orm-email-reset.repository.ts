import { EntityRepository } from '@mikro-orm/core';
import { EmailReset } from '../email-reset.entity';

export class MikroOrmEmailResetRepository extends EntityRepository<EmailReset> { }