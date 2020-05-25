import { BaseEntityModel } from '@gauzy/models';
import { Stage } from './stage.model';
import { AttributeDefinition } from './attribute-definition.model';



export interface StageAttribute extends BaseEntityModel
{
  attributeDefinition: AttributeDefinition;
  isMultivalued: boolean;
  isMandatory: boolean;
  stage: Stage;

  attributeDefinitionId: string;
  stageId: string;
}

export type StageAttributeFindInput = Partial<StageAttributeCreateInput>;

export interface StageAttributeCreateInput
{
  isMultivalued?: boolean;
  isMandatory?: boolean;

  attributeDefinitionId: string;
  stageId: string;
}
