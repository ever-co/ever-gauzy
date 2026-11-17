import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	Controller,
	UseGuards,
	HttpCode,
	HttpStatus,
	Put,
	Param,
	Body,
	Query,
	Get,
	Post,
	Delete,
	Res,
	BadRequestException,
	Headers
} from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { Response } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { I18nLang } from 'nestjs-i18n';
import { PermissionsEnum, IInvoice, LanguagesEnum, IPagination } from '@gauzy/contracts';
import { CrudController, FindOptionsQueryDTO, BaseQueryDTO } from './../core/crud';
import { Invoice } from './invoice.entity';
import { IInvoiceStatistics, InvoiceService } from './invoice.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import {
	InvoiceCreateCommand,
	InvoiceDeleteCommand,
	InvoiceGenerateLinkCommand,
	InvoiceSendEmailCommand,
	InvoiceUpdateCommand,
	InvoiceUpdateWithItemsCommand,
	InvoiceGeneratePdfCommand,
	InvoicePaymentGeneratePdfCommand
} from './commands';
import {
	CreateInvoiceDTO,
	InvoiceStatisticsQueryDTO,
	UpdateEstimateInvoiceDTO,
	UpdateInvoiceActionDTO,
	UpdateInvoiceDTO,
	UpdateInvoiceWithItemsDTO
} from './dto';
import { expectedUpdatedAtOf } from './invoice-precondition';

@ApiTags('Invoice')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INVOICES_EDIT)
@Controller('/invoices')
export class InvoiceController extends CrudController<Invoice> {
	constructor(
		private readonly invoiceService: InvoiceService,
		private readonly commandBus: CommandBus
	) {
		super(invoiceService);
	}

	/**
	 * GET invoice count
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<Invoice>): Promise<number> {
		return await this.invoiceService.countBy(options);
	}

	/**
	 * GET invoices by pagination params
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: BaseQueryDTO<Invoice>): Promise<IPagination<IInvoice>> {
		return await this.invoiceService.pagination(options);
	}

	/**
	 * GET highest invoice number
	 *
	 * @returns
	 */
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('highest')
	async findHighestInvoiceNumber(): Promise<Invoice> {
		return await this.invoiceService.getHighestInvoiceNumber();
	}

	/**
	 * GET one organization's invoice statistics: the count, and the exact totals per currency and per status.
	 *
	 * Scoped to the caller's tenant and the organization the query names (checked against the caller's
	 * memberships); `isEstimate=true` totals the estimates instead. Money is a decimal string per currency.
	 *
	 * @param options The organization and the estimate switch.
	 * @returns The count and the totals.
	 */
	@ApiOperation({ summary: "One organization's invoice count and exact totals per currency and status." })
	@ApiResponse({ status: HttpStatus.OK, description: 'The statistics.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid query.' })
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('statistics')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getStatistics(@Query() options: InvoiceStatisticsQueryDTO): Promise<IInvoiceStatistics> {
		return await this.invoiceService.getStatistics({
			tenantId: options.tenantId,
			organizationId: options.organizationId,
			isEstimate: options.isEstimate
		});
	}

	/**
	 * GET all invoices
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAll(@Query() options: FindOptionsQueryDTO<IInvoice>): Promise<IPagination<IInvoice>> {
		try {
			return await this.invoiceService.findAll(options);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET invoice by ID
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Query('data', ParseJsonPipe) data: any
	): Promise<IInvoice> {
		const { relations = [], findInput = null } = data;
		return this.invoiceService.findOneByIdString(id, {
			where: findInput,
			relations
		});
	}

	/**
	 * Create invoice
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
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateInvoiceDTO): Promise<Invoice> {
		return await this.commandBus.execute(new InvoiceCreateCommand(entity));
	}

	/**
	 * Update invoice
	 *
	 * With `expectedUpdatedAt` (the `updatedAt` the invoice was read with), the change is written only while the
	 * invoice still holds it, in the transaction that compares the two; otherwise nothing is written and the answer is
	 * 409 with the invoice as it is now. Without it, the change is written as it always was.
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update record' })
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
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The invoice changed since expectedUpdatedAt: nothing was saved. `details.invoice` is the invoice as it is now.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Body() entity: UpdateInvoiceDTO
	): Promise<Invoice> {
		return await this.commandBus.execute(new InvoiceUpdateCommand({ ...entity, id }));
	}

	/**
	 * Saves an invoice's fields and all its lines together, in one transaction: a save that fails, or is refused,
	 * writes neither, so an edit is never left half saved as `PUT /invoices/:id` followed by
	 * `POST /invoice-item/bulk/:invoiceId` can leave it. The lines replace every line the invoice holds, and bill the
	 * time they name, as the bulk route's do.
	 *
	 * With `expectedUpdatedAt`, both are written only while the invoice still holds it; otherwise nothing is written
	 * and the answer is 409 with the invoice as it is now. The answer states the invoice's new `updatedAt`.
	 *
	 * @param id The invoice.
	 * @param entity Its fields and its lines.
	 * @returns The invoice as written, with its lines.
	 */
	@ApiOperation({ summary: "Save an invoice's fields and lines together, optionally only if unchanged since read" })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The invoice and its lines were saved.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The invoice changed since expectedUpdatedAt: nothing was saved. `details.invoice` is the invoice as it is now.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id/with-items')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateWithItems(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Body() entity: UpdateInvoiceWithItemsDTO
	): Promise<IInvoice> {
		return await this.commandBus.execute(new InvoiceUpdateWithItemsCommand({ ...entity, id }));
	}

	/**
	 * Update estimate status: the estimate's answer, accepted or not.
	 *
	 * With `expectedUpdatedAt` (the `updatedAt` the estimate was read with), the answer is written only while the
	 * estimate still holds it, in the transaction that compares the two; otherwise nothing is written and the answer is
	 * 409 with the estimate as it is now. Without it, the answer is written as it always was. Either way it moves the
	 * estimate's `updatedAt`, as a status action does (ever-co/ever-teams#5382).
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update estimate invoice' })
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
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The estimate changed since expectedUpdatedAt: nothing was saved. `details.invoice` is the estimate as it is now.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id/estimate')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateEstimate(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Body() entity: UpdateEstimateInvoiceDTO
	) {
		return await this.commandBus.execute(new InvoiceUpdateCommand({ ...entity, id }, { isAction: true }));
	}

	/**
	 * Update invoice/estimate action: void, paid, unpaid, sent and the like.
	 *
	 * With `expectedUpdatedAt` (the `updatedAt` the invoice was read with), the action is written only while the
	 * invoice still holds it, in the transaction that compares the two; otherwise nothing is written and the answer is
	 * 409 with the invoice as it is now. Without it, the action is written as it always was. Either way it moves the
	 * invoice's `updatedAt` (ever-co/ever-teams#5382).
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: "Update Invoice's Status" })
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
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The invoice changed since expectedUpdatedAt: nothing was saved. `details.invoice` is the invoice as it is now.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id/action')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateAction(@Param('id', UUIDValidationPipe) id: IInvoice['id'], @Body() entity: UpdateInvoiceActionDTO) {
		return await this.commandBus.execute(new InvoiceUpdateCommand({ ...entity, id }, { isAction: true }));
	}

	/**
	 * Send estimate/invoice email
	 *
	 * @param email
	 * @param body
	 * @param languageCode
	 * @param originalUrl
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('email/:email')
	async emailInvoice(
		@Param('email') email: string,
		@Body() body: any,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') origin: string
	): Promise<any> {
		return this.commandBus.execute(new InvoiceSendEmailCommand(languageCode, email, body.params, origin));
	}

	/**
	 * Generate invoice/estimate public link
	 *
	 * @param uuid
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('generate/:uuid')
	async generateLink(@Param('uuid', UUIDValidationPipe) uuid: IInvoice['id']): Promise<IInvoice> {
		return await this.commandBus.execute(new InvoiceGenerateLinkCommand(uuid));
	}

	/**
	 * Revokes the public link of an invoice or an estimate: the link stops opening it, wherever it was sent. Generating
	 * a link again, or sending the invoice again, makes a new one.
	 */
	@ApiOperation({ summary: 'Revoke the public link of an invoice or an estimate' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The link no longer opens the invoice' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':id/link')
	async revokeLink(@Param('id', UUIDValidationPipe) id: IInvoice['id']): Promise<void> {
		await this.invoiceService.revokeLink(id);
	}

	/**
	 * Delete invoice
	 *
	 * With `expectedUpdatedAt` in the query string (the `updatedAt` the invoice was read with), the invoice is deleted
	 * only while it still holds it, in the transaction that compares the two; otherwise nothing is deleted and the
	 * answer is 409 with the invoice as it is now. Without it, the invoice is deleted as it always was. The precondition
	 * travels in the query string, as every other parameter of a DELETE route here does: a DELETE body has no defined
	 * meaning, and proxies may drop it.
	 *
	 * @param id
	 * @param expectedUpdatedAt The `updatedAt` the invoice was read with, when the delete is conditional.
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
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'expectedUpdatedAt is no ISO 8601 date and time: nothing was deleted.'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'The invoice changed since expectedUpdatedAt: nothing was deleted. `details.invoice` is the invoice as it is now.'
	})
	@ApiQuery({
		name: 'expectedUpdatedAt',
		required: false,
		type: String,
		description:
			'The updatedAt the invoice was read with (ISO 8601). When stated, the invoice is deleted only if it still ' +
			'holds it; otherwise nothing is deleted and the answer is 409 Conflict.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Query('expectedUpdatedAt') expectedUpdatedAt?: unknown
	): Promise<DeleteResult> {
		const expected = expectedUpdatedAtOf(expectedUpdatedAt);
		return await this.commandBus.execute(new InvoiceDeleteCommand(id, expected));
	}

	/**
	 * Download invoice pdf
	 *
	 * @param uuid
	 * @param locale
	 * @param res
	 * @returns
	 */
	@ApiOperation({ summary: 'Download Invoice' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The invoice has been successfully downloaded'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Invoice not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('download/:uuid')
	async downloadInvoicePdf(
		@Param('uuid', UUIDValidationPipe) uuid: IInvoice['id'],
		@I18nLang() locale: LanguagesEnum,
		@Res() res: Response
	): Promise<any> {
		const buffer: Buffer = await this.commandBus.execute(new InvoiceGeneratePdfCommand(uuid, locale));
		if (!buffer) {
			return;
		}
		const stream = this.invoiceService.getReadableStream(buffer);
		res.set({
			'Content-Type': 'application/pdf',
			'Content-Length': buffer.length
		});
		stream.pipe(res);
	}

	/**
	 * Download invoice payment pdf
	 *
	 * @param uuid
	 * @param locale
	 * @param res
	 * @returns
	 */
	@ApiOperation({ summary: 'Download Invoice' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The invoice has been successfully downloaded'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Invoice not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('payment/download/:uuid')
	async downloadInvoicePaymentPdf(
		@Param('uuid', UUIDValidationPipe) uuid: IInvoice['id'],
		@I18nLang() locale: LanguagesEnum,
		@Res() res: Response
	): Promise<any> {
		const buffer = await this.commandBus.execute(new InvoicePaymentGeneratePdfCommand(uuid, locale));
		if (!buffer) {
			return;
		}
		const stream = this.invoiceService.getReadableStream(buffer);
		res.set({
			'Content-Type': 'application/pdf',
			'Content-Length': buffer.length
		});
		stream.pipe(res);
	}
}
