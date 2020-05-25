import { StageAttributeService } from './stage-attribute.service';
import { StageAttribute } from './stage-attribute.entity';
import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Pipeline' )
@Controller()
export class StageAttributeController extends CrudController<StageAttribute>
{
  public constructor(
    stageAttributeService: StageAttributeService )
  {
    super( stageAttributeService );
  }

}
