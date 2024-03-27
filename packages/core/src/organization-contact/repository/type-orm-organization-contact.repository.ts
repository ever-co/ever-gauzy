import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationContact } from '../organization-contact.entity';

export class TypeOrmOrganizationContactRepository extends Repository<OrganizationContact> {
    constructor(
        @InjectRepository(OrganizationContact) readonly repository: Repository<OrganizationContact>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
