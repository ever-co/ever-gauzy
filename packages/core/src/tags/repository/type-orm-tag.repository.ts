import { Repository } from 'typeorm';
import { Tag } from '../tag.entity';

export class TypeOrmTagRepository extends Repository<Tag> { }
