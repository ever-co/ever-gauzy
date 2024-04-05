import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSprint } from '../organization-sprint.entity';

@Injectable()
export class TypeOrmOrganizationSprintRepository extends Repository<OrganizationSprint> {
    constructor(@InjectRepository(OrganizationSprint) readonly repository: Repository<OrganizationSprint>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
