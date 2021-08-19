import {
	Controller,
	Get,
	UseGuards,
	Query,
	HttpStatus,
	Post,
	Body,
	Put,
	Param,
	UsePipes,
	ValidationPipe,
	ForbiddenException,
	Delete
} from '@nestjs/common';
import {
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import {
	IAccountingTemplate,
	IAccountingTemplateUpdateInput,
	IPagination,
	LanguagesEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../core/crud';
import { RequestContext } from './../core/context';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { LanguageDecorator } from './../shared/decorators';
import { AccountingTemplateQuery } from './queries';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateService } from './accounting-template.service';

@ApiTags('Accounting Template')
@UseGuards(TenantPermissionGuard)
@Controller()
export class AccountingTemplateController extends CrudController<AccountingTemplate> {
	constructor(
		private readonly accountingTemplateService: AccountingTemplateService,
		private readonly queryBus: QueryBus,
	) {
		super(accountingTemplateService);
	}

	@Get('count')
	@UsePipes(new ValidationPipe({ transform: true }))
	async getCount(
		@Query() filter: PaginationParams<IAccountingTemplate>
	): Promise<number> {
		return this.accountingTemplateService.count({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			...filter
		});
	}

	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IAccountingTemplate>
	): Promise<IPagination<IAccountingTemplate>> {
		return this.accountingTemplateService.paginate(filter);
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
	async findTemplate(
		@Query('data', ParseJsonPipe) data: any,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IAccountingTemplate> {
		const { findInput = {} } = data;
		return await this.accountingTemplateService.getAccountTemplate(
			findInput,
			themeLanguage
		)
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
	async generatePreview(@Body() input: any): Promise<any> {
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

	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) filter: PaginationParams<IAccountingTemplate>
	): Promise<IPagination<IAccountingTemplate>> {
		return await this.queryBus.execute(
			new AccountingTemplateQuery(filter)
		);
	}

	@ApiOperation({
		summary: 'Gets template by id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'template found',
		type: AccountingTemplate
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IAccountingTemplate> {
		return this.accountingTemplateService.findOne(id, {
			where: {
				tenantId: RequestContext.currentTenantId(),
			}
		});
	}

	@ApiOperation({
		summary: 'Updates template'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'template updated',
		type: AccountingTemplate
	})
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: IAccountingTemplateUpdateInput,
	): Promise<IAccountingTemplate> {
		const record = await this.findById(id);
		const tenantId = RequestContext.currentTenantId();
		if (tenantId !== record.tenantId) {
			throw new ForbiddenException();
		}
		return this.accountingTemplateService.create({
			id, 
			...{ tenantId, ...input }
		});
	}

	@ApiOperation({
		summary: 'Delete accounting template'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Accounting template deleted',
		type: AccountingTemplate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Accounting template not found'
	})
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string) {
		const record = await this.findById(id);
		const tenantId = RequestContext.currentTenantId();
		if (tenantId !== record.tenantId) {
			throw new ForbiddenException();
		}
		return await this.accountingTemplateService.delete(id);
	}
}
