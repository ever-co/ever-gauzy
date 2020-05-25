import { Controller, UseGuards } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { CrudController } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { Pipeline } from './pipeline.entity';
import { ApiTags } from '@nestjs/swagger';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Pipeline' )
@Controller()
export class PipelineController extends CrudController<Pipeline>
{
  public constructor(
    pipelineService: PipelineService )
  {
    super( pipelineService );
  }

}
