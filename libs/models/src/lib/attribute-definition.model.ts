import { AttributeValidator } from './attribute-validator.model';
import { BaseEntityModel } from '@gauzy/models';



export interface AttributeDefinition extends BaseEntityModel
{
  validators: AttributeValidator[];
  validationScript: string;
  description: string;
  name: string;
}

export type AttributeDefinitionFindInput = Partial<AttributeDefinitionCreateInput>;

export interface AttributeDefinitionCreateInput
{
  validatorReferences?: string[];
  validationScript?: string;
  description: string;
  name: string;
}
