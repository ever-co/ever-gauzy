import { LeadAttributeService } from './lead-attribute.service';
import { LeadAttribute } from './lead-attribute.entity';
import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Pipeline' )
@Controller()
export class LeadAttributeController extends CrudController<LeadAttribute>
{
  public constructor(
    leadAttributeService: LeadAttributeService )
  {
    super( leadAttributeService );
  }

}
