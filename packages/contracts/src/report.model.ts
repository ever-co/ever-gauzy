import { IBaseEntityModel, IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
export interface IReport extends IBaseEntityModel {
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
	extends IBaseEntityModel {
	name?: string;
	iconClass?: string;
	reports?: IReport[];
}
export interface IReportOrganization
	extends IBasePerTenantAndOrganizationEntityModel {
	report?: IReport;
	reportId?: string;
	isEnabled?: boolean;
}

export interface IGetReportCategory 
	extends IBasePerTenantAndOrganizationEntityModel {
	relations?: string[];
	where?: IReport;
}

export interface IGetReport extends IBasePerTenantAndOrganizationEntityModel {
	relations?: string[];
	where?: IReport;
}
export interface UpdateReportMenuInput 
	extends IBasePerTenantAndOrganizationEntityModel {
	reportId?: string;
	isEnabled?: boolean;
}
export interface GetReportMenuItemsInput 
	extends IBasePerTenantAndOrganizationEntityModel {
	organizationId?: string;
}
