import { BaseEntityModel } from '@gauzy/models';



export interface AttributeValidator extends BaseEntityModel, AttributeValidatorCreateInput
{
  description: string;
}

export type AttributeValidatorFind = Partial<AttributeValidatorCreateInput>;

export type AttributeValidatorUpdateInput = Partial<AttributeValidator>;

export interface AttributeValidatorCreateInput
{
  description?: string;
  reference: string;
  script: string;
}
