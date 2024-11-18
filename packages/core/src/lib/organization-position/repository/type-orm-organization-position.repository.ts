import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationPosition } from '../organization-position.entity';

@Injectable()
export class TypeOrmOrganizationPositionRepository extends Repository<OrganizationPosition> {
    constructor(@InjectRepository(OrganizationPosition) readonly repository: Repository<OrganizationPosition>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
