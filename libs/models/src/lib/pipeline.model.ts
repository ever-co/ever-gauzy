import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import {
	IPipelineStageCreateInput,
	IPipelineStage
} from './pipeline-stage.model';

export interface IPipeline extends IBasePerTenantAndOrganizationEntityModel {
	stages: IPipelineStage[];
	description: string;
	name: string;
	isActive: boolean;
}

export type IPipelineFindInput = Partial<Pick<IPipeline, 'id'>>;

export interface IPipelineCreateInput {
	stages?: IPipelineStageCreateInput[];
	organizationId: string;
	description?: string;
	name: string;
	isActive: boolean;
}
