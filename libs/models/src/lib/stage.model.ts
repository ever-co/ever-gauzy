import { BaseEntityModel, Pipeline } from '@gauzy/models';

export interface Stage extends BaseEntityModel, StageUpdateInput
{
  description: string;
  pipeline: Pipeline;
}

export type StageFindInput = Pick<Stage, 'id' | 'name'>

export interface StageUpdateInput extends StageCreateInput {
  pipelineId: string;
}

export interface StageCreateInput
{
  description?: string;
  pipelineId?: string;
  index: number;
  name: string;
}
