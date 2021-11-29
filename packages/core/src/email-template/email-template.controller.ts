import {
	ICustomizableEmailTemplate,
	ICustomizeEmailTemplateFindInput,
	IEmailTemplate,
	IEmailTemplateSaveInput,
	IPagination,
	LanguagesEnum
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import {
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { CrudController, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { LanguageDecorator } from './../shared/decorators';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import {
	EmailTemplateGeneratePreviewQuery,
	EmailTemplateQuery,
	FindEmailTemplateQuery
} from './queries';
import { EmailTemplateSaveCommand } from './commands';


@ApiTags('EmailTemplate')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmailTemplateController extends CrudController<EmailTemplate> {
	constructor(
		private readonly emailTemplateService: EmailTemplateService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {
		super(emailTemplateService);
	}

	@Get('count')
	@UsePipes(new ValidationPipe({ transform: true }))
	async getCount(
		@Query() filter: PaginationParams<IEmailTemplate>
	): Promise<number> {
		return this.emailTemplateService.count({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			...filter
		});
	}

	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IEmailTemplate>
	): Promise<IPagination<IEmailTemplate>> {
		return this.emailTemplateService.paginate(filter);
	}

	@ApiOperation({
		summary:
			'Find email template by name and language code for organization'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found email template',
		type: EmailTemplate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('template')
	async findTemplate(
		@Query('data', ParseJsonPipe) data: any,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<ICustomizableEmailTemplate> {
		const { findInput }: { findInput: ICustomizeEmailTemplateFindInput } = data;
		return await this.queryBus.execute(
			new FindEmailTemplateQuery(findInput, themeLanguage)
		);
	}

	@ApiOperation({
		summary: 'Converts mjml or handlebar text to html for email preview'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'text converted to html',
		type: EmailTemplate
	})
	@Post('template/preview')
	async generatePreview(
		@Body('data') data: string
	): Promise<ICustomizableEmailTemplate> {
		return await this.queryBus.execute(
			new EmailTemplateGeneratePreviewQuery(data)
		);
	}

	@ApiOperation({
		summary: 'Convert mjml or handlebar text to html'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'mjml or handlebar text converted to html',
		type: EmailTemplate
	})
	@Post('template/save')
	async saveTemplate(
		@Body('data') data: IEmailTemplateSaveInput
	): Promise<IEmailTemplate> {
		return await this.commandBus.execute(
			new EmailTemplateSaveCommand(data)
		);
	}

	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) filter: PaginationParams<IEmailTemplate>
	): Promise<IPagination<IEmailTemplate>> {
		return await this.queryBus.execute(
			new EmailTemplateQuery(filter)
		);
	}

	@ApiOperation({
		summary: 'Gets template by id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'template found',
		type: EmailTemplate
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IEmailTemplate> {
		return this.emailTemplateService.findOneByIdString(id, {
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
		type: EmailTemplate
	})
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: IEmailTemplateSaveInput,
	): Promise<IEmailTemplate | UpdateResult> {
		const record = await this.findById(id);
		const tenantId = RequestContext.currentTenantId();
		if (tenantId !== record.tenantId) {
			throw new ForbiddenException();
		}
		return this.emailTemplateService.update(id, { tenantId, ...input });
	}

	@ApiOperation({
		summary: 'Delete email template'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Email template deleted',
		type: EmailTemplate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Email template not found'
	})
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string) {
		const record = await this.findById(id);
		const tenantId = RequestContext.currentTenantId();
		if (tenantId !== record.tenantId) {
			throw new ForbiddenException();
		}
		return await this.emailTemplateService.delete(id);
	}
}
