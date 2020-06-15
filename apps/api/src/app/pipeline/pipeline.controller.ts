import { CrudController, IPagination } from '../core/crud';
import { Pipeline } from './pipeline.entity';
import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PipelineService } from './pipeline.service';
import { ParseJsonPipe } from '../shared/pipes';

@Controller()
@ApiTags('Pipeline')
@UseGuards( AuthGuard( 'jwt' ) )
export class PipelineController extends CrudController<Pipeline> {

	public constructor(
	  protected pipelineService: PipelineService ) {
		super( pipelineService );
	}

  @ApiOperation({ summary: 'find all' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Found records'
  })
  @Get()
  public async findAll( @Query( 'data', ParseJsonPipe ) data: any ): Promise<IPagination<Pipeline>>
  {
    const { relations = [], filter: where = null } = data;

    return this.pipelineService.findAll({
      relations,
      where,
    });
  }

}
