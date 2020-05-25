import { AttributeValueService } from './attribute-value.service';
import { AttributeValue } from './attribute-value.entity';
import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Attribute' )
@Controller()
export class AttributeValueController extends CrudController<AttributeValue>
{
  public constructor(
    attributeValueService: AttributeValueService )
  {
    super( attributeValueService );
  }

}
