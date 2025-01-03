import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { SocialAccount } from '../social-account.entity';

export class MicroOrmSocialAccountRepository extends MikroOrmBaseEntityRepository<SocialAccount> {}
