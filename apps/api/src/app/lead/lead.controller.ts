import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core/crud';
import { LeadService } from './lead.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { Lead } from './lead.entity';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Pipeline' )
@Controller()
export class LeadController extends CrudController<Lead>
{
  public constructor(
    leadService: LeadService )
  {
    super( leadService );
  }

}
