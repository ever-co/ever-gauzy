import { AttributeDefinitionService } from './attribute-definition.service';
import { AttributeDefinition } from './attribute-definition.entity';
import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Attribute' )
@Controller()
export class AttributeDefinitionController extends CrudController<AttributeDefinition>
{
  public constructor(
    attributeDefinitionService: AttributeDefinitionService )
  {
    super( attributeDefinitionService );
  }

}
