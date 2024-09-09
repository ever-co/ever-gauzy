import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployeeEntityInput, IEmployeeEntityMutationInput } from './employee.model';

export interface IEmployeeProposalTemplateBaseInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	content?: string;
	isDefault?: boolean;
}

export interface IEmployeeProposalTemplate extends IEmployeeProposalTemplateBaseInput, IEmployeeEntityInput {}

/**
 * Input for creating a proposal template
 */
export interface IEmployeeProposalTemplateCreateInput
	extends IEmployeeEntityMutationInput,
		IEmployeeProposalTemplateBaseInput {
	name: string;
}

/*
 * Input for updating a proposal template
 */
export interface IEmployeeProposalTemplateUpdateInput extends IEmployeeProposalTemplateBaseInput {}

/**
 * Input for making a proposal template default
 */
export interface IEmployeeProposalTemplateMakeDefaultInput extends IBasePerTenantAndOrganizationEntityModel {
	isDefault: boolean;
}
