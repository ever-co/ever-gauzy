import { User, Tag, OrganizationDepartment, OrganizationPositions } from '..';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Location as ILocation } from './location.model';
import { UserFindInput } from './user.model';
import { OrganizationTeams } from './organization-teams-model';
import { Tenant } from './tenant.model';
import { OrganizationEmploymentType } from './organization-employment-type.model';

export interface Employee extends IBaseEntityModel, ILocation {
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
	tenant: Tenant;
	organizationDepartments?: OrganizationDepartment[];
	organizationPosition?: OrganizationPositions;
	tags: Tag[];
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	employeeLevel?: string;
	anonymousBonus?: boolean;
	organizationEmploymentTypes?: OrganizationEmploymentType[];
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
	organizationDepartment?: OrganizationDepartment;
	organizationPosition?: OrganizationPositions;
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
}

export interface EmployeeCreateInput {
	user: User;
	organization: Organization;
	password?: string;
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	members?: Employee[];
	tags?: Tag[];
}

export enum PayPeriodEnum {
	NONE = 'NONE',
	BI_WEEKLY = 'BI_WEEKLY',
	WEEKLY = 'WEEKLY',
	TWICE_PER_MONTH = 'TWICE_PER_MONTH',
	MONTHLY = 'MONTHLY'
}

export interface EmployeeLevelInput {
	level: string;
	organizationId: string;
}
