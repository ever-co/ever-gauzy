import {
	ICustomizableEmailTemplate,
	ICustomizeEmailTemplateFindInput,
	IEmailTemplateSaveInput
} from '@gauzy/models';
import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import {
	EmailTemplateGeneratePreviewQuery,
	FindEmailTemplateQuery
} from './queries';
import { EmailTemplateSaveCommand } from './commands';

@ApiTags('EmailTemplate')
@Controller()
export class EmailTemplateController extends CrudController<EmailTemplate> {
	constructor(
		private readonly emailTemplateService: EmailTemplateService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {
		super(emailTemplateService);
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
	@Get('findTemplate')
	async findEmailTemplate(
		@Query('data') data: string
	): Promise<ICustomizableEmailTemplate> {
		const {
			findInput
		}: { findInput: ICustomizeEmailTemplateFindInput } = JSON.parse(data);
		return this.queryBus.execute(new FindEmailTemplateQuery(findInput));
	}

	@ApiOperation({
		summary: 'Converts mjml or handlebar text to html for email preview'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'text converted to html',
		type: EmailTemplate
	})
	@Post('emailPreview')
	async generateEmailPreview(
		@Body('data') data: string
	): Promise<ICustomizableEmailTemplate> {
		return this.queryBus.execute(
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
	@Post('saveTemplate')
	async saveEmailTemplate(
		@Body('data') data: IEmailTemplateSaveInput
	): Promise<EmailTemplate> {
		return this.commandBus.execute(new EmailTemplateSaveCommand(data));
	}
}
