import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Comment } from '../comment.entity';

export class MikroOrmCommentRepository extends MikroOrmBaseEntityRepository<Comment> {}
