import { BaseEntityModel } from '@gauzy/models';
import { Stage } from './stage.model';
import { AttributeDefinition } from './attribute-definition.model';



export interface StageAttribute extends BaseEntityModel, StageAttributeCreateInput
{
  attributeDefinition: AttributeDefinition;
  isMultivalued: boolean;
  isMandatory: boolean;
  stage: Stage;
}

export type StageAttributeFindInput = Partial<StageAttributeCreateInput>;

export interface StageAttributeCreateInput
{
  isMultivalued?: boolean;
  isMandatory?: boolean;

  attributeDefinitionId: string;
  stageId: string;
}
