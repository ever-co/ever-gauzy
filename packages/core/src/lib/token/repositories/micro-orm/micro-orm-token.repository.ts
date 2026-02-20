import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { Token } from '../../entities/token.entity';

export class MikroOrmTokenRepository extends MikroOrmBaseEntityRepository<Token> {}
