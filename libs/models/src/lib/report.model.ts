import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IReport extends IBasePerTenantAndOrganizationEntityModel {
	categoryId?: string;
	category?: IReportCategory;
	name?: string;
	slug?: string;
	image?: string;
	description?: string;
	showInMenu?: boolean;
}

export interface IReportCategory
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	image?: string;
	reports?: IReport[];
}

export interface IGetReportCategory {
	relations: string[];
	where?: IReport;
}

export interface IGetReport {
	relations: string[];
	where?: IReport;
}
