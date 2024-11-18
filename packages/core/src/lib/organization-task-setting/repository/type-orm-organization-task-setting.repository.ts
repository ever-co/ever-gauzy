import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationTaskSetting } from '../organization-task-setting.entity';

@Injectable()
export class TypeOrmOrganizationTaskSettingRepository extends Repository<OrganizationTaskSetting> {
    constructor(@InjectRepository(OrganizationTaskSetting) readonly repository: Repository<OrganizationTaskSetting>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
