import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IPipelineStageCreateInput, IPipelineStage } from './pipeline-stage.model';

export interface IPipeline extends IBasePerTenantAndOrganizationEntityModel {
	stages: IPipelineStage[];
	description: string;
	name: string;
}

export type IPipelineFindInput = Partial<Pick<IPipeline, 'id' | 'organizationId' | 'tenantId'>>;

export interface IPipelineCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	stages?: IPipelineStageCreateInput[];
	description?: string;
	name: string;
}

export enum PipelineTabsEnum {
	ACTIONS = 'ACTIONS',
	SEARCH = 'SEARCH'
}
