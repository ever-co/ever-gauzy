import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IOrganizationTaskSetting, IOrganizationTaskSettingFindInput } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { MikroOrmOrganizationTaskSettingRepository, TypeOrmOrganizationTaskSettingRepository } from './repository';

@Injectable()
export class OrganizationTaskSettingService extends TenantAwareCrudService<OrganizationTaskSetting> {
	constructor(
		readonly typeOrmOrganizationTaskSettingRepository: TypeOrmOrganizationTaskSettingRepository,
		readonly mikroOrmOrganizationTaskSettingRepository: MikroOrmOrganizationTaskSettingRepository
	) {
		super(typeOrmOrganizationTaskSettingRepository, mikroOrmOrganizationTaskSettingRepository);
	}

	/**
	 * Find organization task setting.
	 *
	 * @param options - The options to filter the organization task setting.
	 * @returns A Promise resolving to the found organization task setting.
	 */
	async findByOrganization(options: IOrganizationTaskSettingFindInput): Promise<IOrganizationTaskSetting> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { organizationId } = options;

			const whereConditions: FindOptionsWhere<IOrganizationTaskSettingFindInput> = {
				organizationId,
				tenantId,
				isActive: true,
				isArchived: false
			};

			return await this.findOneByOptions({ where: whereConditions });
		} catch (error) {
			// Handle errors during the retrieving operation.
			console.error('Error during organization task settings retrieval:', error.message);
		}
	}
}
