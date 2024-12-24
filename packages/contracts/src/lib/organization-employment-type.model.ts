import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidate } from './candidate.model';
import { ITag } from './tag.model';

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
	tags?: ITag[];
	candidates?: ICandidate[];
}

export interface IOrganizationEmploymentTypeFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}

export interface IOrganizationEmploymentTypeCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags?: ITag[];
}

export enum EmploymentTypeTabsEnum {
	BROWSE = "BROWSE",
	SEARCH = "SEARCH"
}
