import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationEntitySettingTied } from '../integration-entity-setting-tied.entity';

@Injectable()
export class TypeOrmIntegrationEntitySettingTiedRepository extends Repository<IntegrationEntitySettingTied> {
    constructor(@InjectRepository(IntegrationEntitySettingTied) readonly repository: Repository<IntegrationEntitySettingTied>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
