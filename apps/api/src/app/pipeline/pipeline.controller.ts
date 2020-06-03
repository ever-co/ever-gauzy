import { CrudController } from '../core/crud';
import { Pipeline } from './pipeline.entity';
import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PipelineService } from './pipeline.service';

@Controller()
@ApiTags('Pipeline')
@UseGuards( AuthGuard( 'jwt' ) )
export class PipelineController extends CrudController<Pipeline> {
	public constructor(pipelineService: PipelineService) {
		super(pipelineService);
	}
}
