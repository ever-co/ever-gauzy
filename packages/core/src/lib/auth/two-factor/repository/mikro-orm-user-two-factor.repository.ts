import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { UserTwoFactor } from '../user-two-factor.entity';

export class MikroOrmUserTwoFactorRepository extends MikroOrmBaseEntityRepository<UserTwoFactor> {}
