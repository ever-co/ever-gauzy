import {
	BaseEntityModel,
	Organization,
	PipelineStage,
	PipelineStageCreateInput
} from '@gauzy/models';

export interface Pipeline extends BaseEntityModel, PipelineCreateInput {
	organization: Organization;

	description: string;

	stages: PipelineStage[];
}

export type PipelineFindInput = Partial<
	Pick<Pipeline, 'id' | 'organizationId'>
>;

export interface PipelineCreateInput {
	stages?: PipelineStageCreateInput[];

	organizationId: string;

	description?: string;

	name: string;
}
