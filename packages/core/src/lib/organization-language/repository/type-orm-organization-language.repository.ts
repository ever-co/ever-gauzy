import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationLanguage } from '../organization-language.entity';

@Injectable()
export class TypeOrmOrganizationLanguageRepository extends Repository<OrganizationLanguage> {
    constructor(@InjectRepository(OrganizationLanguage) readonly repository: Repository<OrganizationLanguage>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
