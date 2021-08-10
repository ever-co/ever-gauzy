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
import { CrudController } from './../core/crud';
import { OrganizationLanguagesService } from './organization-languages.service';
import { OrganizationLanguages } from './organization-languages.entity';
import { DeepPartial } from 'typeorm';
import { IOrganizationLanguages, IPagination } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationLanguages')
@Controller()
export class OrganizationLanguagesController extends CrudController<OrganizationLanguages> {
	constructor(
		private readonly organizationLanguagesService: OrganizationLanguagesService
	) {
		super(organizationLanguagesService);
	}

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
	@UseGuards(TenantPermissionGuard)
	async create(
		@Body() entity: DeepPartial<OrganizationLanguages>
	): Promise<OrganizationLanguages> {
		return this.organizationLanguagesService.create(entity);
	}

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
	@UseGuards(TenantPermissionGuard)
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<OrganizationLanguages>
	): Promise<any> {
		return this.organizationLanguagesService.update(id, entity);
	}

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
	@UseGuards(TenantPermissionGuard)
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return this.organizationLanguagesService.delete(id);
	}

	@ApiOperation({
		summary: 'Find Organization Language.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Organization Language',
		type: OrganizationLanguages
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findLanguageByOrgId(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationLanguages>> {
		const { relations, findInput } = data;
		return this.organizationLanguagesService.findAll({
			where: findInput,
			relations
		});
	}
}
