import { AttributeValidatorService } from './attribute-validator.service';
import { AttributeValidator } from './attribute-validator.entity';
import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Attribute' )
@Controller()
export class AttributeValidatorController extends CrudController<AttributeValidator>
{
  public constructor(
    attributeValidatorService: AttributeValidatorService )
  {
    super( attributeValidatorService );
  }

}
