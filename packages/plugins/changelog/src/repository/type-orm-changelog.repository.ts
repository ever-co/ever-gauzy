import { Repository } from 'typeorm';
import { Changelog } from '../changelog.entity';

export class TypeOrmChangelogRepository extends Repository<Changelog> { }
