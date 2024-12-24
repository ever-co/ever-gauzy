import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationSetting } from '../integration-setting.entity';

@Injectable()
export class TypeOrmIntegrationSettingRepository extends Repository<IntegrationSetting> {
    constructor(@InjectRepository(IntegrationSetting) readonly repository: Repository<IntegrationSetting>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
