import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationAward } from '../organization-award.entity';

@Injectable()
export class TypeOrmOrganizationAwardRepository extends Repository<OrganizationAward> {
    constructor(@InjectRepository(OrganizationAward) readonly repository: Repository<OrganizationAward>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
