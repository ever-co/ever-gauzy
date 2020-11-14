import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganization } from './organization.model';

export interface IReport extends IBasePerTenantAndOrganizationEntityModel {
	categoryId?: string;
	category?: IReportCategory;
	name?: string;
	slug?: string;
	iconClass?: string;
	image?: string;
	imageUrl?: string;
	description?: string;
	showInMenu?: boolean;
	reportOrganizations?: IReportOrganization[];
}

export interface IReportCategory
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	icon?: string;
	iconUrl?: string;
	reports?: IReport[];
}
export interface IReportOrganization
	extends IBasePerTenantAndOrganizationEntityModel {
	report?: IReport;
	reportId?: string;
	organization?: IOrganization;
	organizationId?: string;
	isEnabled?: boolean;
}

export interface IGetReportCategory {
	relations?: string[];
	where?: IReport;
	organizationId?: string;
}

export interface IGetReport {
	relations?: string[];
	organizationId?: string;
	where?: IReport;
}
export interface UpdateReportMenuInput {
	organizationId?: string;
	reportId?: string;
	isEnabled?: boolean;
}
export interface GetReportMenuItemsInput {
	organizationId?: string;
}
