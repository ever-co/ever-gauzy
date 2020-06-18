import {
	BaseEntityModel,
	Organization,
	Stage,
	StageCreateInput
} from '@gauzy/models';

export interface Pipeline extends BaseEntityModel, PipelineCreateInput {
	organization: Organization;
	description: string;
	stages: Stage[];
}

export interface PipelineFindInput {
	organizationId: string;
}

export interface PipelineCreateInput {
	stages?: StageCreateInput[];
	organizationId: string;
	description?: string;
	name: string;
}
