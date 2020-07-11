import { CrudController, IPagination } from '../core/crud';
import { Pipeline } from './pipeline.entity';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PipelineService } from './pipeline.service';
import { ParseJsonPipe } from '../shared/pipes';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Deal } from '../deal/deal.entity';

@Controller()
@ApiTags('Pipeline')
@UseGuards(AuthGuard('jwt'))
export class PipelineController extends CrudController<Pipeline> {
	public constructor(protected pipelineService: PipelineService) {
		super(pipelineService);
	}

	@ApiOperation({ summary: 'find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	public async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Pipeline>> {
		const { relations = [], filter: where = null } = data;

		return this.pipelineService.findAll({
			relations,
			where
		});
	}

	@ApiOperation({ summary: 'find deals' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get(':id/deals')
	public async findDeals(
		@Param('id') id: string
	): Promise<IPagination<Deal>> {
		return this.pipelineService.findDeals(id);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Post()
	async create(
		@Body() entity: DeepPartial<Pipeline>,
		...options: any[]
	): Promise<Pipeline> {
		return super.create(entity, ...options);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: QueryDeepPartialEntity<Pipeline>,
		...options: any[]
	): Promise<any> {
		return super.update(id, entity, ...options);
	}

	@ApiOperation({ summary: 'Delete record' })
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Delete(':id')
	async delete(@Param('id') id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}
}
