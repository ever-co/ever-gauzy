import { FindOptionsWhere, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IOrganizationTaskSetting, IOrganizationTaskSettingFindInput } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTaskSetting } from './organization-task-setting.entity';

@Injectable()
export class OrganizationTaskSettingService extends TenantAwareCrudService<OrganizationTaskSetting> {
    constructor(
        @InjectRepository(OrganizationTaskSetting)
        private readonly organizationTaskSettingRepository: Repository<OrganizationTaskSetting>
    ) {
        super(organizationTaskSettingRepository);
    }

    /**
     * Find organization task setting.
     *
     * @param options - The options to filter the organization task setting.
     * @returns A Promise resolving to the found organization task setting.
     */
    async findByOrganization(
        options: IOrganizationTaskSettingFindInput
    ): Promise<IOrganizationTaskSetting> {
        try {
            const tenantId = RequestContext.currentTenantId();
            const { organizationId } = options;

            const whereConditions: FindOptionsWhere<IOrganizationTaskSettingFindInput> = {
                organizationId,
                tenantId,
                isActive: true,
                isArchived: false,
            };

            return await this.findOneByOptions({ where: whereConditions });
        } catch (error) {
            // Handle errors during the retrieving operation.
            console.error('Error during organization task settings retrieval:', error);
        }
    }
}
