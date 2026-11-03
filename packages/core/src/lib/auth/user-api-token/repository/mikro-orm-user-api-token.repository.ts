import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { UserApiToken } from '../user-api-token.entity';

export class MikroOrmUserApiTokenRepository extends MikroOrmBaseEntityRepository<UserApiToken> {}
