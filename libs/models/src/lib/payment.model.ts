import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IInvoice } from './invoice.model';
import { ITag } from './tag-entity.model';
import { IUser } from './user.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationProject } from './organization-projects.model';
import { IPaginationInput } from './core.model';
import { IEmployee } from './employee.model';

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
	paymentMethod?: string;
	contact?: IOrganizationContact;
	contactId?: string;
	project?: IOrganizationProject;
	projectId?: string;
}

export interface IPaymentUpdateInput {
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
	BANK_TRANSFER = 'Bank transfer',
	CASH = 'Cash',
	CHEQUE = 'Cheque',
	CREDIT_CARD = 'Credit card',
	DEBIT = 'Debit',
	ONLINE = 'Online'
}

export interface ISelectedPayment {
	data: IPayment;
	isSelected: false;
}
export interface IPaymentReportChartData {
	date: string;
	value: number;
}

export interface IGetPaymentInput
	extends IPaginationInput,
		IBasePerTenantAndOrganizationEntityModel {
	relations?: string[];
	types?: string[];
	titles?: string[];
	groupBy?: string;
	date?: Date | string;
	startDate?: Date | string;
	endDate?: Date | string;
	projectIds?: string[];
	employeeIds?: string[];
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
