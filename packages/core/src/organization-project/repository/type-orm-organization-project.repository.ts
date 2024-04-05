import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationProject } from '../organization-project.entity';

@Injectable()
export class TypeOrmOrganizationProjectRepository extends Repository<OrganizationProject> {
    constructor(@InjectRepository(OrganizationProject) readonly repository: Repository<OrganizationProject>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
