import { StageAttribute, StageAttributeCreateInput } from './stage-attribute.model';
import { BaseEntityModel } from '@gauzy/models';
import { Pipeline } from './pipeline.model';



export interface Stage extends BaseEntityModel
{
  entryStageAttributes: StageAttribute[];
  exitStageAttributes: StageAttribute[];
  pipelineId: string;
  pipeline: Pipeline;
  reference: string;
  name: string;
}

export type StageFindInput = Partial<StageCreateInput>;

export interface StageCreateInput
{
  entryStageAttributes?: StageAttributeCreateInput[];
  exitStageAttributes?: StageAttributeCreateInput[];
  reference?: string;
  pipelineId: string;
  name: string;
}
