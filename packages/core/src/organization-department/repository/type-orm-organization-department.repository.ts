import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationDepartment } from '../organization-department.entity';

@Injectable()
export class TypeOrmOrganizationDepartmentRepository extends Repository<OrganizationDepartment> {
    constructor(@InjectRepository(OrganizationDepartment) readonly repository: Repository<OrganizationDepartment>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
