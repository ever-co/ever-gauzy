import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationPositions } from './organization-positions.entity';

@Injectable()
export class OrganizationPositionsService extends CrudService<OrganizationPositions> {
    constructor(
        @InjectRepository(OrganizationPositions) private readonly organizationPositionsRepository: Repository<OrganizationPositions>
    ) {
        super(organizationPositionsRepository);
    }
}
