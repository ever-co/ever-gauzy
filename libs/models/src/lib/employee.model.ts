import { User, Tag, OrganizationDepartment, OrganizationPositions } from '..';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Location as ILocation } from './location.model';
import { UserFindInput } from './user.model';
import { OrganizationTeam } from './organization-team-model';
import { ITenant } from '@gauzy/models';
import { OrganizationEmploymentType } from './organization-employment-type.model';
import { RequestApprovalEmployee } from './request-approval-employee.model';

export interface Employee extends IBaseEntityModel, ILocation {
	endWork?: any;
	startedWorkOn?: any;
	user: User;
	userId: string;
	organization: Organization;
	orgId: string;
	valueDate?: Date;
	isActive: boolean;
	teams?: OrganizationTeam[];
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	tenant: ITenant;
	organizationDepartments?: OrganizationDepartment[];
	organizationPosition?: OrganizationPositions;
	tags: Tag[];
	offerDate?: Date;
	acceptDate?: Date;
	rejectDate?: Date;
	employeeLevel?: string;
	anonymousBonus?: boolean;
	organizationEmploymentTypes?: OrganizationEmploymentType[];
	requestApprovalEmployee?: RequestApprovalEmployee[];
}

export interface EmployeeFindInput extends IBaseEntityModel {
	organization?: OrganizationFindInput;
	user?: UserFindInput;
	valueDate?: Date;
	orgId?: string;
	tags?: Tag[];
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
	startedWorkOn?: any;
}

export enum PayPeriodEnum {
	NONE = 'NONE',
	BI_WEEKLY = 'BI_WEEKLY',
	WEEKLY = 'WEEKLY',
	TWICE_PER_MONTH = 'TWICE_PER_MONTH',
	MONTHLY = 'MONTHLY'
}
export interface EmployeeLevel {
	id: string;
	level: string;
	organizationId: string;
	tag?: Tag[];
}

export interface EmployeeLevelInput {
	id?: string;
	level: string;
	organizationId: string;
	tags?: Tag[];
}
