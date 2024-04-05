import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEmploymentType } from '../organization-employment-type.entity';

@Injectable()
export class TypeOrmOrganizationEmploymentTypeRepository extends Repository<OrganizationEmploymentType> {
    constructor(@InjectRepository(OrganizationEmploymentType) readonly repository: Repository<OrganizationEmploymentType>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
