import { EntityRepository } from '@mikro-orm/knex';
import { PasswordReset } from '../password-reset.entity';

export class MikroOrmPasswordResetRepository extends EntityRepository<PasswordReset> { }
