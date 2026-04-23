import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IPaginationInput } from './core.model';
import { CurrencyPosition } from './organization.model';

/**
 * Enum representing the status of a payroll run
  */
export enum PayrollRunStatusEnum {
	DRAFT = 'DRAFT',
	PENDING_APPROVAL = 'PENDING_APPROVAL',
	APPROVED = 'APPROVED',
	PROCESSING = 'PROCESSING',
	PAID = 'PAID',
	CANCELLED = 'CANCELLED'
}

/**
 * Enum representing the frequency of payroll
  */
export enum PayrollFrequencyEnum {
	WEEKLY = 'WEEKLY',
	BI_WEEKLY = 'BI_WEEKLY',
	SEMI_MONTHLY = 'SEMI_MONTHLY',
	MONTHLY = 'MONTHLY',
	QUARTERLY = 'QUARTERLY',
	ANNUALLY = 'ANNUALLY'
}

/**
 * Enum representing the type of a payroll item/component
  */
export enum PayrollItemTypeEnum {
	BASIC_SALARY = 'BASIC_SALARY',
	ALLOWANCE = 'ALLOWANCE',
	BONUS = 'BONUS',
	COMMISSION = 'COMMISSION',
	OVERTIME = 'OVERTIME',
	TAX_DEDUCTION = 'TAX_DEDUCTION',
	SOCIAL_SECURITY = 'SOCIAL_SECURITY',
	HEALTH_INSURANCE = 'HEALTH_INSURANCE',
	LOAN_DEDUCTION = 'LOAN_DEDUCTION',
	ADVANCE_DEDUCTION = 'ADVANCE_DEDUCTION',
	LEAVE_DEDUCTION = 'LEAVE_DEDUCTION',
	OTHER_ADDITION = 'OTHER_ADDITION',
	OTHER_DEDUCTION = 'OTHER_DEDUCTION'
}

/**
 * Enum indicating whether a payroll item adds or deducts from net pay
  */
export enum PayrollItemCategoryEnum {
	EARNING = 'EARNING',
	DEDUCTION = 'DEDUCTION'
}

/**
 * Interface representing a single Payroll Run (pay period)
  */
export interface IPayrollRun extends IBasePerTenantAndOrganizationEntityModel {
	periodStart: Date;
	periodEnd: Date;
	payDate: Date;
	frequency: PayrollFrequencyEnum;
	status: PayrollRunStatusEnum;
	currency: string;
	totalGross: number;
	totalDeductions: number;
	totalNet: number;
	notes?: string;
	items?: IPayrollItem[];
}

/**
 * Interface for creating a new Payroll Run
  */
export interface IPayrollRunCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	periodStart: Date;
	periodEnd: Date;
	payDate: Date;
	frequency: PayrollFrequencyEnum;
	currency: string;
	notes?: string;
}

/**
 * Interface for updating an existing Payroll Run
  */
export interface IPayrollRunUpdateInput extends Partial<IPayrollRunCreateInput> {
	id: ID;
	status?: PayrollRunStatusEnum;
	totalGross?: number;
	totalDeductions?: number;
	totalNet?: number;
}

/**
 * Interface for finding/filtering Payroll Runs
  */
export interface IPayrollRunFindInput extends IPaginationInput {
	organizationId?: ID;
	tenantId?: ID;
	status?: PayrollRunStatusEnum;
	frequency?: PayrollFrequencyEnum;
	periodStart?: Date;
	periodEnd?: Date;
}

/**
 * Interface representing a single line item within a Payroll Run
  */
export interface IPayrollItem extends IBasePerTenantAndOrganizationEntityModel {
	payrollRunId: ID;
	payrollRun?: IPayrollRun;
	employeeId: ID;
	employee?: IEmployee;
	type: PayrollItemTypeEnum;
	category: PayrollItemCategoryEnum;
	description?: string;
	amount: number;
	quantity?: number;
	unitPrice?: number;
	taxable: boolean;
}

/**
 * Interface for creating a Payroll Item
  */
export interface IPayrollItemCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	payrollRunId: ID;
	employeeId: ID;
	type: PayrollItemTypeEnum;
	category: PayrollItemCategoryEnum;
	description?: string;
	amount: number;
	quantity?: number;
	unitPrice?: number;
	taxable?: boolean;
}

/**
 * Interface for finding/filtering Payroll Items
  */
export interface IPayrollItemFindInput extends IPaginationInput {
	payrollRunId?: ID;
	employeeId?: ID;
	type?: PayrollItemTypeEnum;
	category?: PayrollItemCategoryEnum;
}

/**
 * Interface for payroll summary statistics per employee
  */
export interface IPayrollSummary {
	employeeId: ID;
	employee?: IEmployee;
	periodStart: Date;
	periodEnd: Date;
	grossPay: number;
	totalDeductions: number;
	netPay: number;
	currency: string;
}

/**
 * Interface for overall payroll statistics
  */
export interface IPayrollStatistics {
	totalRuns: number;
	totalEmployeesPaid: number;
	totalGrossPaid: number;
	totalDeductions: number;
	totalNetPaid: number;
	currency: string;
}
