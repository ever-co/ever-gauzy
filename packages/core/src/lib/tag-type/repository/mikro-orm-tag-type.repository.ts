import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { TagType } from '../tag-type.entity';

export class MikroOrmTagTypeRepository extends MikroOrmBaseEntityRepository<TagType> {}
