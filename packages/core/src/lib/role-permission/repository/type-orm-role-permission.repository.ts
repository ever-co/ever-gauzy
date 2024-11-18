import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from '../role-permission.entity';

@Injectable()
export class TypeOrmRolePermissionRepository extends Repository<RolePermission> {
    constructor(@InjectRepository(RolePermission) readonly repository: Repository<RolePermission>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
