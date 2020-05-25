import { Controller, UseGuards } from '@nestjs/common';
import { StageService } from './stage.service';
import { CrudController } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { Stage } from './stage.entity';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Pipeline' )
@Controller()
export class StageController extends CrudController<Stage>
{
  public constructor(
    stageService: StageService )
  {
    super( stageService );
  }

}
