import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationClients } from './organization-clients.entity';

@Injectable()
export class OrganizationClientsService extends CrudService<OrganizationClients> {
    constructor(
        @InjectRepository(OrganizationClients) private readonly organizationClientsRepository: Repository<OrganizationClients>
    ) {
        super(organizationClientsRepository);
    }
}
