import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { Video } from '../entities/video.entity';

export class MikroOrmVideoRepository extends MikroOrmBaseEntityRepository<Video> {}
