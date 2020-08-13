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
  Get, Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationLanguagesService } from './organization-languages.service';
import { OrganizationLanguages } from './organization-languages.entity';
import { AuthGuard } from '@nestjs/passport';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IPagination } from '../core/crud';

@ApiTags('Organization-Languages')
@Controller()
export class OrganizationLanguagesController extends CrudController<
	OrganizationLanguages
> {
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
	@UseGuards(AuthGuard('jwt'))
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
	@UseGuards(AuthGuard('jwt'))
	async update(
		@Param('id') id: string,
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
	@UseGuards(AuthGuard('jwt'))
	async delete(@Param('id') id: string): Promise<any> {
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
    @Query('data') data: string
  ): Promise<IPagination<OrganizationLanguages>> {
    const { relations, findInput } = JSON.parse(data);
    return this.organizationLanguagesService.findAll({
      where: findInput,
      relations
    });
  }
}
