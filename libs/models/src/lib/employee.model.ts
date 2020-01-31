import { User } from '..';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { UserFindInput } from './user.model';
import { OrganizationTeams } from './organization-teams-model';

export interface Employee extends IBaseEntityModel {
	endWork?: any;
	user: User;
	userId: string;
	organization: Organization;
	orgId: string;
	valueDate?: Date;
	isActive: boolean;
	teams?: OrganizationTeams[];
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
}

export interface EmployeeFindInput extends IBaseEntityModel {
	organization?: OrganizationFindInput;
	user?: UserFindInput;
	valueDate?: Date;
	orgId?: string;
}

export interface EmployeeUpdateInput {
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
}

export interface EmployeeCreateInput {
	user: User;
	organization: Organization;
	members?: Employee[];
}

export enum PayPeriodEnum {
	NONE = 'NONE',
	BI_WEEKLY = 'BI_WEEKLY',
	WEEKLY = 'WEEKLY',
	TWICE_PER_MONTH = 'TWICE_PER_MONTH',
	MONTHLY = 'MONTHLY'
}
