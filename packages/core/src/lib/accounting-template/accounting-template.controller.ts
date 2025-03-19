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
	Delete,
	BadRequestException
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import {
	IAccountingTemplate,
	IAccountingTemplateUpdateInput,
	ID,
	IPagination,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UseValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { Permissions, LanguageDecorator } from './../shared/decorators';
import { AccountingTemplateQuery } from './queries';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateService } from './accounting-template.service';
import { AccountingTemplateQueryDTO, SaveAccountingTemplateDTO } from './dto';

@ApiTags('Accounting Template')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
@Controller('/accounting-template')
export class AccountingTemplateController extends CrudController<AccountingTemplate> {
	constructor(
		private readonly accountingTemplateService: AccountingTemplateService,
		private readonly queryBus: QueryBus
	) {
		super(accountingTemplateService);
	}

	/**
	 * GET count for accounting template
	 *
	 * @param options
	 * @returns
	 */
	@Get('/count')
	@UseValidationPipe({ transform: true })
	async getCount(@Query() options: FindOptionsWhere<AccountingTemplate>): Promise<number> {
		return await this.accountingTemplateService.countBy(options);
	}

	/**
	 * GET accounting templates using pagination params
	 *
	 * @param options
	 * @returns
	 */
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() options: PaginationParams<AccountingTemplate>
	): Promise<IPagination<IAccountingTemplate>> {
		return await this.accountingTemplateService.paginate(options);
	}

	/**
	 * GET accounting template
	 *
	 * @param options
	 * @param themeLanguage
	 * @returns
	 */
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
	@Get('/template')
	@UseValidationPipe({
		transform: true,
		whitelist: true
	})
	async getAccountingTemplate(
		@Query() options: AccountingTemplateQueryDTO,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IAccountingTemplate> {
		return await this.accountingTemplateService.getAccountTemplate(options, themeLanguage);
	}

	@ApiOperation({
		summary: 'Converts mjml or handlebar text to html for template preview'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'text converted to html',
		type: AccountingTemplate
	})
	@Post('/template/preview')
	async generatePreview(@Body() input: any): Promise<any> {
		return this.accountingTemplateService.generatePreview(input);
	}

	/**
	 * Save accounting template to the organization
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({
		summary: 'Converts mjml or handlebar text to html for template preview'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'text converted to html',
		type: AccountingTemplate
	})
	@Post('/template/save')
	@UseValidationPipe()
	async saveTemplate(@Body() entity: SaveAccountingTemplateDTO): Promise<IAccountingTemplate | UpdateResult> {
		try {
			return await this.accountingTemplateService.saveTemplate(entity);
		} catch (error) {
			throw new BadRequestException();
		}
	}

	@Get()
	async findAll(@Query() options: PaginationParams<AccountingTemplate>): Promise<IPagination<IAccountingTemplate>> {
		return await this.queryBus.execute(new AccountingTemplateQuery(options));
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
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IAccountingTemplate> {
		try {
			return await this.accountingTemplateService.findOneByIdString(id);
		} catch (error) {
			console.log(error);

			throw new BadRequestException();
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
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: IAccountingTemplateUpdateInput
	): Promise<IAccountingTemplate> {
		try {
			await this.accountingTemplateService.create({
				id,
				...input
			});
			return await this.findById(id);
		} catch (error) {
			throw new BadRequestException();
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
	async delete(@Param('id', UUIDValidationPipe) id: ID) {
		try {
			return await this.accountingTemplateService.delete(id);
		} catch (error) {
			throw new BadRequestException();
		}
	}
}
