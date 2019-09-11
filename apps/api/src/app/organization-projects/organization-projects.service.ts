import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationProjects } from './organization-projects.entity';

@Injectable()
export class OrganizationProjectsService extends CrudService<OrganizationProjects> {
    constructor(
        @InjectRepository(OrganizationProjects) private readonly organizationProjectsRepository: Repository<OrganizationProjects>
    ) {
        super(organizationProjectsRepository);
    }
}
