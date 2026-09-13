import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IUser } from './user.model';
import { IPaginationInput } from './core.model';

/**
 * Lifecycle of a payroll run.
 *
 * `DRAFT -> PENDING_APPROVAL -> APPROVED -> PROCESSING -> PAID`, with `CANCELLED` reachable from
 * any state before `PAID`. `PAID` is terminal: money has left the building.
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
 * How often a payroll run recurs.
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
 * What a payroll line item represents.
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
 * Whether a line item adds to or subtracts from net pay.
 */
export enum PayrollItemCategoryEnum {
	EARNING = 'EARNING',
	DEDUCTION = 'DEDUCTION'
}

/**
 * One payroll run — a single pay period for an organization.
 *
 * The totals are derived from the run's items and are recomputed by the server when the run is
 * processed; they are never accepted from a client.
 */
export interface IPayrollRun extends IBasePerTenantAndOrganizationEntityModel {
	periodStart: Date;
	periodEnd: Date;
	payDate: Date;
	frequency: PayrollFrequencyEnum;
	status: PayrollRunStatusEnum;
	/** ISO 4217 currency code. */
	currency: string;
	totalGross: number;
	totalDeductions: number;
	totalNet: number;
	notes?: string;
	/** When the run was approved, and by whom. */
	approvedAt?: Date;
	approvedByUserId?: ID;
	approvedBy?: IUser;
	/** When the run was marked paid. */
	paidAt?: Date;
	items?: IPayrollItem[];
}

export interface IPayrollRunCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	periodStart: Date;
	periodEnd: Date;
	payDate: Date;
	frequency: PayrollFrequencyEnum;
	currency: string;
	notes?: string;
}

/**
 * Editable fields of a payroll run.
 *
 * `status` and the three totals are deliberately absent: the status only moves through the
 * workflow endpoints, and the totals are derived. Accepting either here would let a caller mark a
 * run `PAID`, or write any total they liked, with a plain update.
 */
export type IPayrollRunUpdateInput = Partial<Omit<IPayrollRunCreateInput, 'tenantId'>>;

export interface IPayrollRunFindInput extends IPaginationInput {
	organizationId?: ID;
	tenantId?: ID;
	status?: PayrollRunStatusEnum;
	frequency?: PayrollFrequencyEnum;
	/** Lower bound of the `periodStart` range to search. */
	periodStart?: Date;
	/** Upper bound of the `periodStart` range to search. */
	periodEnd?: Date;
}

/**
 * One earning or deduction line within a payroll run.
 */
export interface IPayrollItem extends IBasePerTenantAndOrganizationEntityModel {
	payrollRunId: ID;
	payrollRun?: IPayrollRun;
	/** Nullable so a line item survives the deletion of the employee it was paid to. */
	employeeId?: ID;
	employee?: IEmployee;
	type: PayrollItemTypeEnum;
	category: PayrollItemCategoryEnum;
	description?: string;
	/** Always a positive amount; `category` decides whether it adds or subtracts. */
	amount: number;
	quantity?: number;
	unitPrice?: number;
	taxable: boolean;
}

export interface IPayrollItemCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	type: PayrollItemTypeEnum;
	category: PayrollItemCategoryEnum;
	description?: string;
	amount: number;
	quantity?: number;
	unitPrice?: number;
	taxable?: boolean;
}

export interface IPayrollItemFindInput extends IPaginationInput {
	payrollRunId?: ID;
	employeeId?: ID;
	type?: PayrollItemTypeEnum;
	category?: PayrollItemCategoryEnum;
}

/**
 * What one employee earned, was deducted and takes home in one payroll run.
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
 * Totals across every paid payroll run of an organization, per currency.
 *
 * Runs are grouped by currency because summing amounts in different currencies produces a number
 * that means nothing.
 */
export interface IPayrollStatistics {
	totalRuns: number;
	totalEmployeesPaid: number;
	totalGrossPaid: number;
	totalDeductions: number;
	totalNetPaid: number;
	currency: string;
}
