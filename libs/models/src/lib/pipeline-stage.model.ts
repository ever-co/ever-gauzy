import { BaseEntityModel, ITenant, Organization, Pipeline } from '@gauzy/models';

export interface PipelineStage
	extends BaseEntityModel,
		PipelineStageUpdateInput {
	description: string;
	pipeline: Pipeline;
	index: number;
  organization?: Organization;
  tenant: ITenant;
}

export type PipelineStageFindInput = Pick<PipelineStage, 'id' | 'name'>;

export interface PipelineStageUpdateInput extends PipelineStageCreateInput {
	pipelineId?: string;
	id?: string;
}

export interface PipelineStageCreateInput {
	description?: string;
	pipelineId?: string;
	name: string;
}
