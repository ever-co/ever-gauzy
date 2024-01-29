import { Repository } from 'typeorm';
import { User } from '../user.entity';

export class TypeOrmUserRepository extends Repository<User> { }