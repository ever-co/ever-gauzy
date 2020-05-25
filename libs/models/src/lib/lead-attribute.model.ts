import { BaseEntityModel } from '@gauzy/models';
import { Lead } from './lead.model';
import { StageAttribute } from './stage-attribute.model';
import { AttributeValue } from './attribute-value.model';



export interface LeadAttribute extends BaseEntityModel, LeadAttributeCreateInput
{
  attributeValue: AttributeValue;
  stageAttribute: StageAttribute;
  lead: Lead;
}

export type LeadAttributeFindInput = Partial<LeadAttributeCreateInput>;

export interface LeadAttributeCreateInput
{
  attributeValueId: string;
  stageAttributeId: string;
  leadId: string;
}
