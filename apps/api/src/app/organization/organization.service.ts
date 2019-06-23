import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class OrganizationService extends CrudService<Organization> {
    constructor(
        @InjectRepository(Organization) private readonly organizationRepository: Repository<Organization>
    ) {
        super(organizationRepository);
    }
}
