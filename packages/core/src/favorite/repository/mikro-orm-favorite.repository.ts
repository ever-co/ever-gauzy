import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Favorite } from '../favorite.entity';

export class MikroOrmFavoriteRepository extends MikroOrmBaseEntityRepository<Favorite> {}
