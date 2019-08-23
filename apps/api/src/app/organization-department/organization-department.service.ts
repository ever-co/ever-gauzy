import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationDepartment } from './organization-department.entity';

@Injectable()
export class OrganizationDepartmentService extends CrudService<OrganizationDepartment> {
    constructor(
        @InjectRepository(OrganizationDepartment) private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>
    ) {
        super(organizationDepartmentRepository);
    }
}
