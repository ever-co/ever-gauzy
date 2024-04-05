import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../role.entity';

@Injectable()
export class TypeOrmRoleRepository extends Repository<Role> {
    constructor(@InjectRepository(Role) readonly repository: Repository<Role>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
