import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { UserOrganization } from './user-organization.entity';

@Injectable()
export class UserOrganizationService extends CrudService<UserOrganization> {
    constructor(@InjectRepository(UserOrganization) private readonly userOrganizationRepository: Repository<UserOrganization>) {
        super(userOrganizationRepository);
    }
}
