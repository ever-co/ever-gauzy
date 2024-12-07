import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization.entity';

@Injectable()
export class TypeOrmOrganizationRepository extends Repository<Organization> {
    constructor(@InjectRepository(Organization) readonly repository: Repository<Organization>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
