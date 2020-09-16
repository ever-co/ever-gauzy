import { IEmployee } from './employee.model';
import { IOrganizationContact } from './organization-contact.model';
import {
	CurrenciesEnum,
	ProjectBillingEnum,
	ProjectOwnerEnum
} from './organization.model';
import { IBaseEntityWithMembers } from './entity-with-members.model';
import { ITag } from './tag-entity.model';
import { ITask } from './task-entity.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IPayment } from './payment.model';

export interface IOrganizationProject extends IBaseEntityWithMembers {
	name: string;
	organizationContact?: IOrganizationContact;
	organizationContactId?: string;
	startDate?: Date;
	endDate?: Date;
	billing: string;
	currency: string;
	members?: IEmployee[];
	public: boolean;
	tags: ITag[];
	owner: string;
	tasks?: ITask[];
	organizationSprints?: IOrganizationSprint[];
	taskListType: string;
	payments?: IPayment[];
	// prefix to project tasks / issues, e.g. GA-XXXX (GA is prefix)
	code?: string;
	description?: string;
	// the color of project which is used in UI
	color?: string;
	// is project billable?
	billable?: boolean;
	// true if the project is flat rate, false if the project is time / materials billable
	billingFlat?: boolean;
}

export enum TaskListTypeEnum {
	GRID = 'GRID',
	SPRINT = 'SPRINT'
}

export interface IOrganizationProjectsFindInput {
	name?: string;
	organizationId?: string;
	organizationContactId?: string;
	organizationContact?: IOrganizationContact;
	members?: IEmployee[];
	public?: boolean;
	tags?: ITag[];
	billable?: boolean;
	billingFlat?: boolean;
}

export interface IOrganizationProjectsCreateInput {
	name: string;
	organizationId: string;
	organizationContact?: IOrganizationContact;
	organizationContactId?: string;
	startDate?: Date;
	endDate?: Date;
	billing?: ProjectBillingEnum;
	currency?: CurrenciesEnum;
	members?: IEmployee[];
	public?: boolean;
	tags?: ITag[];
	owner?: ProjectOwnerEnum;
	code?: string;
	description?: string;
	color?: string;
	billable?: boolean;
	billingFlat?: boolean;
	status?: string;
}

export interface IOrganizationProjectsUpdateInput
	extends IOrganizationProjectsCreateInput {
	id?: string;
}
