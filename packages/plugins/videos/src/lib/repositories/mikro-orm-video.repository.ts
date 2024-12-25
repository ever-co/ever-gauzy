import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Video } from '../entities/video.entity';

export class MikroOrmVideoRepository extends MikroOrmBaseEntityRepository<Video> {}
