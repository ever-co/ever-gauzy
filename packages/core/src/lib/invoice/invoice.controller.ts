import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import {
	InvoiceCreateCommand,
	InvoiceDeleteCommand,
	InvoiceGenerateLinkCommand,
	InvoiceSendEmailCommand,
	InvoiceUpdateCommand,
	InvoiceGeneratePdfCommand,
	InvoicePaymentGeneratePdfCommand
} from './commands';
import { CreateInvoiceDTO, UpdateEstimateInvoiceDTO, UpdateInvoiceActionDTO, UpdateInvoiceDTO } from './dto';

@ApiTags('Invoice')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INVOICES_EDIT)
@Controller('/invoices')
export class InvoiceController extends CrudController<Invoice> {
	constructor(private readonly invoiceService: InvoiceService, private readonly commandBus: CommandBus) {
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
	async pagination(@Query() options: PaginationParams<Invoice>): Promise<IPagination<IInvoice>> {
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
	 * GET all invoices
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAll(@Query() options: OptionParams<IInvoice>): Promise<IPagination<IInvoice>> {
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
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Body() entity: UpdateInvoiceDTO
	): Promise<Invoice> {
		return await this.commandBus.execute(new InvoiceUpdateCommand({ id, ...entity }));
	}

	/**
	 * Update estimate status
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
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id/estimate')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateEstimate(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Body() entity: UpdateEstimateInvoiceDTO
	) {
		return await this.commandBus.execute(new InvoiceUpdateCommand({ id, ...entity }));
	}

	/**
	 * Update invoice/estimate action
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
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id/action')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateAction(@Param('id', UUIDValidationPipe) id: IInvoice['id'], @Body() entity: UpdateInvoiceActionDTO) {
		return await this.commandBus.execute(new InvoiceUpdateCommand({ id, ...entity }));
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
	async delete(@Param('id', UUIDValidationPipe) id: IInvoice['id']): Promise<DeleteResult> {
		return await this.commandBus.execute(new InvoiceDeleteCommand(id));
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
