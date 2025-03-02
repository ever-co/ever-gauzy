import {
	Controller,
	UseGuards,
	HttpStatus,
	HttpCode,
	Post,
	Body,
	Put,
	Param,
	Delete,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeepPartial, DeleteResult } from 'typeorm';
import { IOrganizationLanguage, IPagination } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CrudController } from './../core/crud';
import { OrganizationLanguageService } from './organization-language.service';
import { OrganizationLanguage } from './organization-language.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationLanguage')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-languages')
export class OrganizationLanguageController extends CrudController<OrganizationLanguage> {
	constructor(private readonly organizationLanguageService: OrganizationLanguageService) {
		super(organizationLanguageService);
	}

	/**
	 * GET all organization language
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find Organization Language.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Organization Language',
		type: OrganizationLanguage
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationLanguage>> {
		const { relations, findInput } = data;
		return this.organizationLanguageService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE organization language
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(@Body() entity: DeepPartial<OrganizationLanguage>): Promise<OrganizationLanguage> {
		return this.organizationLanguageService.create(entity);
	}

	/**
	 * UPDATE organization language by id
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<OrganizationLanguage>
	): Promise<any> {
		return this.organizationLanguageService.update(id, entity);
	}

	/**
	 * DELETE organization language by id
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
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<DeleteResult> {
		return this.organizationLanguageService.delete(id);
	}
}
