import {
	Controller,
	Get,
	UseGuards,
	Query,
	HttpStatus,
	Post,
	Body,
	Put,
	Param
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from './../shared/guards';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateService } from './accounting-template.service';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { IPagination } from '../core';
import { IAccountingTemplate } from '@gauzy/contracts';

@ApiTags('Accounting Template')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class AccountingTemplateController extends CrudController<AccountingTemplate> {
	constructor(
		private readonly accountingTemplateService: AccountingTemplateService
	) {
		super(accountingTemplateService);
	}

	@Get()
	async findAllTemplates(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IAccountingTemplate>> {
		const { relations = [], findInput = null } = data;
		return this.accountingTemplateService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({
		summary: 'Gets template by id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'template found',
		type: AccountingTemplate
	})
	@Get('template/:id')
	async getTemplateById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return this.accountingTemplateService.findOne(id);
	}

	@ApiOperation({
		summary: 'Find template by name and language code for organization'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found template',
		type: AccountingTemplate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('template')
	async findAccountingTemplate(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IAccountingTemplate> {
		const { findInput } = data;
		return await this.accountingTemplateService.getAccountTemplate(findInput)
	}

	@ApiOperation({
		summary: 'Converts mjml or handlebar text to html for temaplate preview'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'text converted to html',
		type: AccountingTemplate
	})
	@Post('template/preview')
	async generateTemplatePreview(@Body() input: any): Promise<any> {
		return this.accountingTemplateService.generatePreview(input);
	}

	@ApiOperation({
		summary: 'Converts mjml or handlebar text to html for temaplate preview'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'text converted to html',
		type: AccountingTemplate
	})
	@Post('template/save')
	async saveTemplate(@Body() input: any): Promise<any> {
		return this.accountingTemplateService.saveTemplate(input);
	}

	@ApiOperation({
		summary: 'Updates template'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'template updated',
		type: AccountingTemplate
	})
	@Put('template/update/:id')
	async updateTemplate(
		@Body() input: any,
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return this.accountingTemplateService.create({ id, ...input });
	}
}
