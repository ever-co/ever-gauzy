import { IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel } from './base-entity.model';
import { IInvoice } from './invoice.model';
import { ITag } from './tag.model';
import { IUser } from './user.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationProject } from './organization-projects.model';
import { IPaginationInput } from './core.model';
import { IEmployee } from './employee.model';
import { ReportGroupByFilter } from './report.model';
import { IGetTimeLogReportInput } from './timesheet.model';

export interface IPayment extends IBasePerTenantAndOrganizationEntityModel {
	invoice?: IInvoice;
	invoiceId?: string;
	tags?: ITag[];
	note?: string;
	recordedBy?: IUser;
	employeeId?: string;
	employee?: IEmployee;
	paymentDate?: Date;
	amount?: number;
	currency?: string;
	overdue?: boolean;
	paymentMethod?: PaymentMethodEnum;
	organizationContact?: IOrganizationContact;
	organizationContactId?: string;
	project?: IOrganizationProject;
	projectId?: string;
}

export interface IPaymentUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	amount?: number;
	note?: string;
	currency?: string;
	paymentDate?: Date;
}

export interface IPaymentFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	invoiceId?: string;
}

export enum PaymentMethodEnum {
	BANK_TRANSFER = 'BANK_TRANSFER',
	CASH = 'CASH',
	CHEQUE = 'CHEQUE',
	CREDIT_CARD = 'CREDIT_CARD',
	DEBIT = 'DEBIT',
	ONLINE = 'ONLINE'
}

export interface ISelectedPayment {
	data: IPayment;
	isSelected: false;
}
export interface IPaymentReportChartData {
	date: string;
	value: number;
}

export interface IGetPaymentInput extends IPaginationInput, IGetTimeLogReportInput {
	types?: string[];
	titles?: string[];
	date?: Date | string;
	contactIds?: string[];
}

export interface IPaymentReportGroupByDate {
	date: string;
	employees: {
		employee: IEmployee;
		projects: {
			project: IOrganizationProject;
			payments: IPayment;
			sum: number;
		}[];
	}[];
}

export interface IPaymentReportGroupByEmployee {
	employee: IEmployee;
	dates: {
		date: string;
		projects: {
			project: IOrganizationProject;
			payments: IPayment;
			sum: number;
		}[];
	}[];
}

export interface IPaymentReportGroupByProject {
	project: IOrganizationProject;
	dates: {
		date: string;
		employees: {
			employee: IEmployee;
			payments: IPayment;
			sum: number;
		}[];
	}[];
}

export interface IPaymentReportGroupByClient {
	client: IOrganizationContact;
	dates: {
		date: string;
		employees: {
			employee: IEmployee;
			payments: IPayment;
			sum: number;
		}[];
	}[];
}

export type IPaymentReportData =
	| IPaymentReportGroupByDate
	| IPaymentReportGroupByEmployee
	| IPaymentReportGroupByClient
	| IPaymentReportGroupByProject;
