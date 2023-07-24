import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { RequestContext } from '../core/context';

@Injectable()
export class OrganizationTaskSettingService extends TenantAwareCrudService<OrganizationTaskSetting> {
    constructor(
        @InjectRepository(OrganizationTaskSetting)
        private readonly organizationTaskSettingRepository: Repository<OrganizationTaskSetting>
    ) {
        super(organizationTaskSettingRepository);
    }

    /**
     * Find organization task setting
     *
     * @param organizationId
     * @param options
     * @returns
     */
    async findByOrganizationId(
        organizationId: IOrganizationTaskSetting['id'],
    ): Promise<IOrganizationTaskSetting> {
        const tenantId = RequestContext.currentTenantId();

        const {
            record
        } = await this.findOneOrFailByOptions({
            where: {
                organizationId,
                tenantId
            }
        });

        return record;
    }

}
