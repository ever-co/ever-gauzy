import { BaseEntityModel } from '@gauzy/models';
import { Lead } from './lead.model';
import { StageAttribute } from './stage-attribute.model';
import { AttributeValue } from './attribute-value.model';



export interface LeadAttribute extends BaseEntityModel
{
  attributeValue: AttributeValue;
  stageAttribute: StageAttribute;
  lead: Lead;

  attributeValueId?: string;
  stageAttributeId?: string;
  leadId?: string;
}

export type LeadAttributeFindInput = Partial<LeadAttributeCreateInput>;

export interface LeadAttributeCreateInput
{
  attributeValueId: string;
  stageAttributeId: string;
  leadId: string;
}
