import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IInvoice } from './invoice.model';
import { ITag, ITaggable } from './tag.model';
import { IUser } from './user.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationProject } from './organization-projects.model';
import { IPaginationInput } from './core.model';
import { IEmployee } from './employee.model';
import { IGetTimeLogReportInput } from './timesheet.model';
import { CurrenciesEnum } from './currency.model';

/**
 * Interface representing payment statistics.
 */
export interface PaymentStats {
	count: number; // The count of payments
	amount: number; // The total amount of all payments
}

export interface IPayment extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	invoice?: IInvoice;
	invoiceId?: ID;
	note?: string;
	recordedBy?: IUser;
	employeeId?: ID;
	employee?: IEmployee;
	paymentDate?: Date;
	amount?: number;
	currency?: string;
	overdue?: boolean;
	paymentMethod?: PaymentMethodEnum;
	organizationContact?: IOrganizationContact;
	organizationContactId?: ID;
	project?: IOrganizationProject;
	projectId?: ID;
}

export interface IPaymentUpdateInput
	extends Pick<IPayment, 'amount' | 'note' | 'currency' | 'paymentDate'>,
		IBasePerTenantAndOrganizationEntityModel {}

export interface IPaymentFindInput extends Pick<IPayment, 'invoiceId'>, IBasePerTenantAndOrganizationEntityModel {}

export enum PaymentMethodEnum {
	BANK_TRANSFER = 'BANK_TRANSFER',
	CASH = 'CASH',
	CHEQUE = 'CHEQUE',
	CREDIT_CARD = 'CREDIT_CARD',
	DEBIT = 'DEBIT',
	ONLINE = 'ONLINE'
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
