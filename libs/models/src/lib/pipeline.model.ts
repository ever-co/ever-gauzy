import { BaseEntityModel, Organization } from '@gauzy/models';



export interface Pipeline extends BaseEntityModel, PipelineCreateInput
{
  organization: Organization;
  description: string;
  reference: string;
}

export type PipelineFindInput = Partial<PipelineCreateInput>;

export interface PipelineCreateInput
{
  organizationId: string;
  description?: string;
  reference?: string;
  name: string;
}
