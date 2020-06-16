import { BaseEntityModel, Pipeline } from '@gauzy/models';

export interface Stage extends BaseEntityModel, StageUpdateInput
{
  description: string;
  pipeline: Pipeline;
  index: number;
}

export type StageFindInput = Pick<Stage, 'id' | 'name'>

export interface StageUpdateInput extends StageCreateInput {
  pipelineId?: string;
  id?: string;
}

export interface StageCreateInput
{
  description?: string;
  pipelineId?: string;
  name: string;
}
