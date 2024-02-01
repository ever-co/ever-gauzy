import { EntityRepository } from '@mikro-orm/core';
import { PasswordReset } from '../password-reset.entity';

export class MikroOrmPasswordResetRepository extends EntityRepository<PasswordReset> { }