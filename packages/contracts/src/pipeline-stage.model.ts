import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IPipeline } from './pipeline.model';

export interface IPipelineStage
	extends IBasePerTenantAndOrganizationEntityModel {
	description: string;
	pipeline: IPipeline;
	index: number;
	pipelineId: string;
	id?: string;
	name: string;
}

export type IPipelineStageFindInput = Pick<IPipelineStage, 'id' | 'name'>;

export interface IPipelineStageUpdateInput extends IPipelineStageCreateInput {
	pipelineId?: string;
	id?: string;
}

export interface IPipelineStageCreateInput {
	description?: string;
	pipelineId?: string;
	name: string;
}
