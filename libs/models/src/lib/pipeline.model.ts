import { BaseEntityModel, Organization } from '@gauzy/models';

export interface Pipeline extends BaseEntityModel, PipelineCreateInput
{
  organization: Organization;
}

export interface PipelineFindInput
{
  organizationId: string;
}

export interface PipelineCreateInput
{
  organizationId: string;
  name: string;
}
