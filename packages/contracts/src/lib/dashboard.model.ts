import { IBasePerTenantAndOrganizationEntityModel, JsonData } from './base-entity.model';
import { ExcludeCreatorFields, IHasCreator } from './user.model';

/**
 * Interface representing a Dashboard entity.
 */
export interface IDashboard extends IBasePerTenantAndOrganizationEntityModel, IHasCreator {
	name: string;
	identifier: string;
	description?: string;
	contentHtml?: JsonData;
	isDefault?: boolean;
}

/**
 * Input interface for creating a Dashboard entity.
 */
export interface IDashboardCreateInput extends ExcludeCreatorFields<IDashboard>, Omit<IDashboard, 'isDefault'> {}

/**
 * Input interface for updating a Dashboard entity.
 */
export interface IDashboardUpdateInput extends ExcludeCreatorFields<Partial<IDashboardCreateInput>> {}
