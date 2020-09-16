import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export enum GenericEmploymentTypes {
	INTERN = 'Intern',
	CONTRACT = 'Contract',
	PROBATION = 'Probation',
	PART_TIME = 'Part-time',
	FULL_TIME = 'Full-time',
	CONTRACTOR = 'Contractor'
}

export interface IOrganizationEmploymentType
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags: ITag[];
}

export interface IOrganizationEmploymentTypeFindInput {
	organizationId?: string;
}

export interface IOrganizationEmploymentTypeCreateInput {
	name: string;
	organizationId: string;
	tags: ITag[];
}
