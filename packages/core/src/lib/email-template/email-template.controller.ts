import { IEmailTemplate, IEmailTemplateSaveInput, IPagination, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { RequestContext } from './../core/context';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions, LanguageDecorator } from './../shared/decorators';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateGeneratePreviewQuery, EmailTemplateQuery, FindEmailTemplateQuery } from './queries';
import { EmailTemplateSaveCommand } from './commands';
import {
	CreateEmailTemplateDTO,
	EmailTemplatePreviewDTO,
	EmailTemplateQueryDTO,
	SaveEmailTemplateDTO
} from './dto';
import { stripEmailTemplateScopeFields } from './email-template.scope';

@ApiTags('EmailTemplate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
@Controller('/email-template')
export class EmailTemplateController extends CrudController<EmailTemplate> {
	constructor(
		private readonly emailTemplateService: EmailTemplateService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {
		super(emailTemplateService);
	}

	/**
	 * GET count for email templates in the same tenant
	 *
	 * @param options
	 * @returns
	 */
	@Get('count')
	@UseValidationPipe()
	async getCount(@Query() options: FindOptionsWhere<EmailTemplate>): Promise<number> {
		return await this.emailTemplateService.countBy({
			...options,
			tenantId: RequestContext.currentTenantId()
		});
	}

	/**
	 * GET email templates using pagination params
	 *
	 * @param options
	 * @returns
	 */
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: BaseQueryDTO<EmailTemplate>): Promise<IPagination<IEmailTemplate>> {
		return await this.emailTemplateService.paginate(options);
	}

	/**
	 * GET specific email template by conditions
	 *
	 * @param themeLanguage
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find email template by name and language code for organization'
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
	@UseValidationPipe({ whitelist: true })
	async findEmailTemplate(
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@Query() options: EmailTemplateQueryDTO
	): Promise<IEmailTemplate> {
		return await this.queryBus.execute(new FindEmailTemplateQuery(options, themeLanguage));
	}

	/**
	 * Generate email template preview
	 *
	 * @param input - `{ data }`: the MJML or Handlebars text to render
	 * @returns
	 */
	@ApiOperation({
		summary: 'Converts mjml or handlebar text to html for email preview'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'text converted to html',
		type: EmailTemplate
	})
	@Post('template/preview')
	@UseValidationPipe({ whitelist: true })
	async generatePreview(@Body() input: EmailTemplatePreviewDTO): Promise<IEmailTemplate> {
		return await this.queryBus.execute(new EmailTemplateGeneratePreviewQuery(input.data));
	}

	/**
	 * SAVE email template for specific language
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({
		summary: 'Convert mjml or handlebar text to html'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'mjml or handlebar text converted to html',
		type: EmailTemplate
	})
	@Post('template/save')
	@UseValidationPipe({ whitelist: true })
	async saveEmailTemplate(@Body() entity: SaveEmailTemplateDTO): Promise<IEmailTemplate> {
		return await this.commandBus.execute(new EmailTemplateSaveCommand(entity));
	}

	/**
	 * GET email templates in the same tenant
	 *
	 * @param options
	 * @returns
	 */
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: BaseQueryDTO<EmailTemplate>): Promise<IPagination<IEmailTemplate>> {
		return await this.queryBus.execute(new EmailTemplateQuery(options));
	}

	/**
	 * FIND email template by id in the same tenant
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({
		summary: 'Gets template by id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'template found',
		type: EmailTemplate
	})
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<IEmailTemplate> {
		try {
			return await this.emailTemplateService.findOneByIdString(id, {
				where: {
					tenantId: RequestContext.currentTenantId()
				}
			});
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * UPDATE email template by id in the same tenant
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
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
		@Body() input: IEmailTemplateSaveInput
	): Promise<IEmailTemplate | UpdateResult> {
		try {
			await this.findById(id);
			return await this.emailTemplateService.update(
				{
					id,
					tenantId: RequestContext.currentTenantId()
				},
				// The body is unvalidated: never let it move the template to another tenant or
				// organization, or turn it into a global (NULL-tenant) template.
				stripEmailTemplateScopeFields(input)
			);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * DELETE email template by id in the same tenant
	 *
	 * @param id
	 * @returns
	 */
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
		try {
			await this.findById(id);
			return await this.emailTemplateService.delete({
				id,
				tenantId: RequestContext.currentTenantId()
			});
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * CREATE email template in the caller's tenant.
	 *
	 * Overrides the inherited `CrudController.create()`: `EmailTemplateService` is a plain `CrudService`,
	 * so the inherited route persisted the client's `tenantId` / `organizationId` verbatim — a template
	 * could be written into another tenant, or as a GLOBAL (NULL-tenant) template every tenant reads
	 * (GHSA-44pv-34gx-q9p4). The tenant is pinned to the caller's; the organization must be one the caller
	 * belongs to. The web editor saves through `POST template/save`, which is unaffected.
	 *
	 * `whitelist` drops everything `CreateEmailTemplateDTO` does not declare, so no undeclared key of the
	 * body reaches persistence — `stripEmailTemplateScopeFields` below stays as the explicit statement of
	 * which fields are scope fields.
	 *
	 * @param entity - The template to create.
	 * @returns The created template.
	 */
	@ApiOperation({ summary: 'Create email template in the current tenant' })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateEmailTemplateDTO): Promise<EmailTemplate> {
		const payload = (entity ?? {}) as CreateEmailTemplateDTO;
		const { organizationId } = payload;
		const created = await this.emailTemplateService.create({
			...stripEmailTemplateScopeFields(payload),
			// Checked against the caller's memberships by `CreateEmailTemplateDTO`.
			...(organizationId ? { organizationId } : {}),
			tenantId: RequestContext.currentTenantId()
		} as DeepPartial<EmailTemplate>);

		// Answer with the row as it was STORED, read back through the tenant-scoped lookup, rather than
		// echoing the request body back with an id attached. The client then sees the scope fields the
		// server pinned instead of the ones it sent, and nothing that was never persisted. It also keeps
		// the request body out of the response, which is what CodeQL's js/reflected-xss flags here (not
		// exploitable — the response is JSON and helmet sets `X-Content-Type-Options: nosniff` — but the
		// echo has no value worth defending).
		return (await this.findById(created.id)) as EmailTemplate;
	}

	/**
	 * SOFT DELETE email template by id in the same tenant.
	 *
	 * Overrides the inherited route, which looked the row up by id alone on this non tenant-aware service:
	 * any tenant could soft-delete another tenant's template, or a global default (GHSA-44pv-34gx-q9p4).
	 * `findById` only resolves rows of the caller's tenant, so global templates are refused too.
	 *
	 * @param id - The template id.
	 * @returns The soft-deleted template.
	 */
	@ApiOperation({ summary: 'Soft delete email template' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	async softRemove(@Param('id', UUIDValidationPipe) id: string): Promise<EmailTemplate> {
		await this.findById(id);
		return await this.emailTemplateService.softRemove(id, {
			where: { tenantId: RequestContext.currentTenantId() }
		});
	}

	/**
	 * RECOVER a soft-deleted email template by id in the same tenant. See {@link softRemove}.
	 *
	 * @param id - The template id.
	 * @returns The recovered template.
	 */
	@ApiOperation({ summary: 'Recover soft-deleted email template' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	async softRecover(@Param('id', UUIDValidationPipe) id: string): Promise<EmailTemplate> {
		return await this.emailTemplateService.softRecover(id, {
			where: { tenantId: RequestContext.currentTenantId() }
		});
	}
}
