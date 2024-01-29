import { Repository } from 'typeorm';
import { Tag } from '../tag.entity';

export class TypeOrmTagsRepository extends Repository<Tag> { }
