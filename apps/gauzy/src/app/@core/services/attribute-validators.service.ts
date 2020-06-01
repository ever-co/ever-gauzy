import { Injectable } from '@angular/core';
import { AttributeValidator, AttributeValidatorCreateInput, AttributeValidatorUpdateInput } from '@gauzy/models';
import { Service } from './service';



@Injectable()
export class AttributeValidatorsService extends Service<AttributeValidator, AttributeValidatorCreateInput, AttributeValidatorUpdateInput>
{

  public async findByReference( referenceLike: string ): Promise<AttributeValidator[]> {
    return this.entries.filter( ({ reference }) => reference.includes( referenceLike ) );
  }

}
