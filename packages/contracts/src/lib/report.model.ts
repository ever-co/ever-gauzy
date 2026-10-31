import { IBaseEntityModel, IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface IReport extends IBaseEntityModel {
	categoryId?: IReportCategory['id'];
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

export interface IReportCategory extends IBaseEntityModel {
	name?: string;
	iconClass?: string;
	reports?: IReport[];
}

export interface IReportOrganization extends IBasePerTenantAndOrganizationEntityModel {
	report?: IReport;
	reportId?: string;
	isEnabled?: boolean;
}

export interface IGetReportCategory extends IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel {
	where?: IReport;
}

export interface IGetReport extends IGetReportCategory { }

export interface UpdateReportMenuInput extends IBasePerTenantAndOrganizationEntityModel {
	reportId?: string;
	isEnabled?: boolean;
}

export interface GetReportMenuItemsInput extends IBasePerTenantAndOrganizationEntityModel { }

export interface ReportDayData {
	employee?: IEmployee;
	dates: any;
	sum: number;
	activity: number;
	/** What the employee's tracked time in the range costs at their bill rate; `null` when they have no rate. */
	spent?: number | null;
	/** The currency `spent` is in: the employee's bill rate currency, or the organization's when the rate states none. */
	currency?: IEmployee['billRateCurrency'] | null;
}

export enum ReportGroupFilterEnum {
	date = 'date',
	employee = 'employee',
	project = 'project',
	client = 'client'
}

export type ReportGroupByFilter = keyof typeof ReportGroupFilterEnum;
