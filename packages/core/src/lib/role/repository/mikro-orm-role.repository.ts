import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Role } from '../role.entity';

export class MikroOrmRoleRepository extends MikroOrmBaseEntityRepository<Role> { }
