import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationDocument } from '../organization-document.entity';

@Injectable()
export class TypeOrmOrganizationDocumentRepository extends Repository<OrganizationDocument> {
    constructor(@InjectRepository(OrganizationDocument) readonly repository: Repository<OrganizationDocument>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
