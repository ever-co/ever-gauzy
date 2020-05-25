import { AttributeDefinition } from './attribute-definition.model';
import { BaseEntityModel } from '@gauzy/models';



export interface AttributeValue extends BaseEntityModel
{
  attributeDefinition: AttributeDefinition;
  values: string[];

  attributeDefinitionId?: string;
}

export type AttributeValueFindInput = Partial<Pick<AttributeValueCreateInput, 'attributeDefinitionId'>>;

export interface AttributeValueCreateInput
{
  attributeDefinitionId: string;
  values: string[];
}
