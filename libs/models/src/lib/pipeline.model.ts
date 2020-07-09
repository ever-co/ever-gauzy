import { BaseEntityModel, Organization, Stage, StageCreateInput } from '@gauzy/models';

export interface Pipeline extends BaseEntityModel, PipelineCreateInput
{
  organization: Organization;

  description: string;

  stages: Stage[];
}

export type PipelineFindInput = Partial<Pick<Pipeline, 'id' | 'organizationId'>>

export interface PipelineCreateInput
{
  stages?: StageCreateInput[];

  organizationId: string;

  description?: string;

  name: string;
}
