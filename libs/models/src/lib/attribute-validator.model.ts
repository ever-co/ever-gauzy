import { BaseEntityModel } from '@gauzy/models';



export interface AttributeValidator extends BaseEntityModel, AttributeValidatorCreateInput
{
  parameters: string[];
}

export type AttributeValidatorFind = Partial<AttributeValidatorCreateInput>;

export interface AttributeValidatorCreateInput
{
  parameters?: string[];
  description: string;
  reference: string;
  script: string;
}
