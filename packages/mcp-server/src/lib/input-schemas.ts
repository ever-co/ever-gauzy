/**
 * Simplified input schemas for MCP tools.
 *
 * This file contains only simple enums and a generic record type to avoid
 * TypeScript compilation overhead from complex Zod schema type inference.
 */
import { z } from 'zod';

// ===== SIMPLE ENUMS ONLY =====

export const TimeLogTypeEnum = z.enum(['TRACKED', 'MANUAL', 'IDLE', 'RESUMED']);
export const TimeLogSourceEnum = z.enum([
	'BROWSER',
	'DESKTOP',
	'MOBILE',
	'UPWORK',
	'HUBSTAFF',
	'TEAMS',
	'BROWSER_EXTENSION',
	'CLOC'
]);
export const TaskStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'IN_REVIEW', 'BLOCKED', 'COMPLETED']);
export const TaskPriorityEnum = z.enum(['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST']);
export const TaskSizeEnum = z.enum(['X_SMALL', 'SMALL', 'MEDIUM', 'LARGE', 'X_LARGE']);
export const TaskTypeEnum = z.enum(['BUG', 'FEATURE', 'STORY', 'TASK', 'EPIC']);
export const PayPeriodEnum = z.enum(['NONE', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY']);
export const CurrenciesEnum = z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY']);
export const DailyPlanStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED']);
export const ContactTypeEnum = z.enum(['CLIENT', 'CUSTOMER', 'LEAD']);
export const BonusTypeEnum = z.enum(['PROFIT_BASED_BONUS', 'REVENUE_BASED_BONUS']);
export const DefaultValueDateTypeEnum = z.enum(['TODAY', 'END_OF_MONTH', 'START_OF_MONTH']);
export const WeekDaysEnum = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
export const ProductTypeEnum = z.enum(['DIGITAL', 'PHYSICAL', 'SERVICE']);
export const InvoiceStatusEnum = z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'ACTIVE', 'FULLY_PAID', 'CANCELLED']);
export const InvoiceTypeEnum = z.enum([
	'BY_EMPLOYEE_HOURS',
	'BY_PROJECT_HOURS',
	'BY_TASK_HOURS',
	'BY_PRODUCTS',
	'BY_FLAT_FEE',
	'DETAILS_INVOICE_ITEMS'
]);
export const ExpenseCategoriesEnum = z.enum([
	'MARKETING',
	'SALES',
	'ADMINISTRATION',
	'OPERATIONS',
	'RESEARCH_AND_DEVELOPMENT',
	'HUMAN_RESOURCES',
	'TRAVEL',
	'OFFICE_SUPPLIES',
	'TRAINING',
	'LEGAL',
	'ACCOUNTING',
	'CONSULTING',
	'UTILITIES',
	'RENT',
	'OTHER'
]);
export const GoalTimeFrameEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']);
export const GoalLevelEnum = z.enum(['ORGANIZATION', 'TEAM', 'EMPLOYEE']);
export const CandidateStatusEnum = z.enum(['APPLIED', 'REJECTED', 'HIRED', 'INTERVIEW', 'ON_HOLD']);
export const DealStatusEnum = z.enum([
	'LEAD',
	'QUALIFIED_LEAD',
	'PROPOSAL_MADE',
	'NEGOTIATION',
	'CLOSED_WON',
	'CLOSED_LOST'
]);
export const IncomeTypeEnum = z.enum(['SALARY', 'BONUS', 'OVERTIME', 'COMMISSION', 'OTHER']);
export const PaymentStatusEnum = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']);
export const PaymentMethodEnum = z.enum([
	'CREDIT_CARD',
	'DEBIT_CARD',
	'BANK_TRANSFER',
	'PAYPAL',
	'STRIPE',
	'CASH',
	'CHECK',
	'OTHER'
]);
export const EquipmentTypeEnum = z.enum([
	'LAPTOP',
	'DESKTOP',
	'MONITOR',
	'MOBILE',
	'PRINTER',
	'FURNITURE',
	'SOFTWARE_LICENSE',
	'OTHER'
]);
export const EquipmentStatusEnum = z.enum(['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED', 'LOST', 'DAMAGED']);
export const TimeOffStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'DENIED', 'CANCELLED']);
export const TimeOffTypeEnum = z.enum([
	'VACATION',
	'SICK_LEAVE',
	'PERSONAL',
	'MATERNITY',
	'PATERNITY',
	'BEREAVEMENT',
	'OTHER'
]);
export const ReportCategoryEnum = z.enum(['FINANCIAL', 'HR', 'PROJECT', 'TIME_TRACKING', 'SALES', 'CUSTOM']);
export const CommentableTypeEnum = z.enum(['TASK', 'PROJECT', 'GOAL', 'CANDIDATE', 'DEAL', 'INVOICE', 'OTHER']);
export const ActivityLogActionEnum = z.enum([
	'CREATED',
	'UPDATED',
	'DELETED',
	'VIEWED',
	'ASSIGNED',
	'COMPLETED',
	'APPROVED',
	'REJECTED'
]);
export const ActivityLogEntityEnum = z.enum([
	'USER',
	'EMPLOYEE',
	'TASK',
	'PROJECT',
	'GOAL',
	'INVOICE',
	'EXPENSE',
	'DEAL',
	'CANDIDATE'
]);
export const ActorTypeEnum = z.enum(['System', 'User']);
export const SortOrderEnum = z.enum(['ASC', 'DESC']);
export const ActivityLogSortByEnum = z.enum(['createdAt', 'updatedAt', 'entity', 'action']);

// Activity log specific
export const ALLOWED_ACTIVITY_LOG_RELATIONS = ['createdBy', 'employee'] as const;
export const ActivityLogRelationsSchema = z.array(z.enum(ALLOWED_ACTIVITY_LOG_RELATIONS)).optional();

// ===== GENERIC INPUT SCHEMAS =====
// These use z.record() to avoid complex type inference. Runtime validation still works.

/**
 * Generic entity input - accepts any key-value pairs.
 * Use this for create/update operations where validation is handled server-side.
 */
export const GenericInputSchema = z.record(z.string(), z.any());

// Alias for backward compatibility - all specific schemas map to generic
export const TaskInputSchema = GenericInputSchema;
export const EmployeeInputSchema = GenericInputSchema;
export const ProjectInputSchema = GenericInputSchema;
export const DailyPlanInputSchema = GenericInputSchema;
export const GoalInputSchema = GenericInputSchema;
export const InvoiceInputSchema = GenericInputSchema;
export const ExpenseInputSchema = GenericInputSchema;
export const IncomeInputSchema = GenericInputSchema;
export const KeyResultInputSchema = GenericInputSchema;
export const DealInputSchema = GenericInputSchema;
export const CandidateInputSchema = GenericInputSchema;
export const PaymentInputSchema = GenericInputSchema;
export const MerchantInputSchema = GenericInputSchema;
export const EquipmentInputSchema = GenericInputSchema;
export const CommentInputSchema = GenericInputSchema;
export const TimeOffPolicyInputSchema = GenericInputSchema;
export const TimeOffRequestInputSchema = GenericInputSchema;
export const ReportInputSchema = GenericInputSchema;
export const EmployeeAwardInputSchema = GenericInputSchema;
export const ActivityLogInputSchema = GenericInputSchema;
export const PipelineInputSchema = GenericInputSchema;
export const SkillInputSchema = GenericInputSchema;
export const WarehouseInputSchema = GenericInputSchema;
export const ProductInputSchema = GenericInputSchema;
export const ProductCategoryInputSchema = GenericInputSchema;
export const OrganizationContactInputSchema = GenericInputSchema;
