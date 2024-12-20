import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationEntitySetting } from '../integration-entity-setting.entity';

@Injectable()
export class TypeOrmIntegrationEntitySettingRepository extends Repository<IntegrationEntitySetting> {
    constructor(@InjectRepository(IntegrationEntitySetting) readonly repository: Repository<IntegrationEntitySetting>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
