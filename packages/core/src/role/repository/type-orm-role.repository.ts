import { Repository } from 'typeorm';
import { Role } from '../role.entity';

export class TypeOrmRoleRepository extends Repository<Role> { }