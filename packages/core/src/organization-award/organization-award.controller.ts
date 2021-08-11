import {
	Controller,
	UseGuards,
	HttpStatus,
	HttpCode,
	Post,
	Body,
	Delete,
	Param,
	Put,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IOrganizationAward, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationAwardService } from './organization-award.service';
import { OrganizationAward } from './organization-award.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationAward')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationAwardController extends CrudController<OrganizationAward> {
	constructor(
		private readonly organizationAwardService: OrganizationAwardService
	) {
		super(organizationAwardService);
	}

	/**
	 * GET organization award
	 * 
	 * @param data 
	 * @returns 
	 */
	 @ApiOperation({
		summary: 'Find Organization Awards.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Organization Awards',
		type: OrganizationAward
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationAward>> {
		const { findInput } = data;
		return this.organizationAwardService.findAll({
			where: findInput
		});
	}

	/**
	 * CREATE organization award
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: DeepPartial<OrganizationAward>
	): Promise<OrganizationAward> {
		return this.organizationAwardService.create(entity);
	}

	/**
	 * UPDATE organization award by id
	 * 
	 * @param id 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Update an existing record' })
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
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<OrganizationAward>
	): Promise<any> {
		return this.organizationAwardService.update(id, entity);
	}

	/**
	 * DELETE organization award by id
	 * 
	 * @param id 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return this.organizationAwardService.delete(id);
	}
}
