import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PasswordReset } from '../password-reset.entity';

export class MikroOrmPasswordResetRepository extends MikroOrmBaseEntityRepository<PasswordReset> {}
