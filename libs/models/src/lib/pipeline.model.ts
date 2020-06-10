import { BaseEntityModel, Organization } from '@gauzy/models';

export interface Pipeline extends BaseEntityModel, PipelineCreateInput
{
  organization: Organization;
  description: string;
}

export interface PipelineFindInput
{
  organizationId: string;
}

export interface PipelineCreateInput
{
  organizationId: string;
  description?: string;
  name: string;
}
