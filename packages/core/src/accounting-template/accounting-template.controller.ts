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
import { FindOptionsWhere } from 'typeorm';
import {
	IAccountingTemplate,
	IAccountingTemplateUpdateInput,
	IPagination,
	LanguagesEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../core/crud';
import { RequestContext } from './../core/context';
import { TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';
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

	/**
	 * GET count for accouting template
	 *
	 * @param options
	 * @returns
	 */
	@Get('count')
	async getCount(
		@Query(new ValidationPipe({
			transform: true
		})) options: FindOptionsWhere<AccountingTemplate>
	): Promise<number> {
		return this.accountingTemplateService.countBy(options);
	}

	/**
	 * GET accouting templates using pagination params
	 *
	 * @param options
	 * @returns
	 */
	@Get('pagination')
	async pagination(
		@Query(new ValidationPipe({
			transform: true
		})) options: PaginationParams<AccountingTemplate>
	): Promise<IPagination<IAccountingTemplate>> {
		return this.accountingTemplateService.paginate(options);
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
	async getAccoutingTemplate(
		@Query(new ValidationPipe({
			transform: true
		})) options: FindOptionsWhere<AccountingTemplate>,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IAccountingTemplate> {
		return await this.accountingTemplateService.getAccountTemplate(
			options,
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
		@Query(new ValidationPipe({
			transform: true
		})) options: PaginationParams<AccountingTemplate>
	): Promise<IPagination<IAccountingTemplate>> {
		return await this.queryBus.execute(
			new AccountingTemplateQuery(options)
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
		try {
			return await this.accountingTemplateService.findOneByWhereOptions({
				id,
				tenantId: RequestContext.currentTenantId()
			});
		} catch (error) {
			throw new ForbiddenException();
		}
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
		try {
			await this.findById(id);
			return await this.accountingTemplateService.create({
				id,
				...input
			});
		} catch (error) {
			throw new ForbiddenException();
		}
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
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	) {
		try {
			await this.findById(id);
			return await this.accountingTemplateService.delete(id);
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
