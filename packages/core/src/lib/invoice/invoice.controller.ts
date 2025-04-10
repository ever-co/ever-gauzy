import { ApiOperation, ApiResponse, ApiTags, ApiBody, ApiQuery, ApiPropertyOptional } from '@nestjs/swagger';
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
	Headers,
	ValidationPipe
} from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { Response } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { I18nLang } from 'nestjs-i18n';
import {
	PermissionsEnum,
	IInvoice,
	LanguagesEnum,
	IPagination,
	InvoiceErrors,
	EMPLOYEE_INVOICE_STATUSES
} from '@gauzy/contracts';
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
import { RequestContext } from '../core/context';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

class InvoicePaginationParams<T> extends PaginationParams<T> {
	/**
	 * Flag to filter invoices by B2B or own invoices
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Transform((params: TransformFnParams) => params.value.toLowerCase() === 'true')
	readonly isB2B: boolean;
}

@ApiTags('Invoice')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INVOICES_EDIT)
@Controller()
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
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<Invoice>): Promise<number> {
		this.invoiceService.checkIfUserCanAccessInvoiceForRead(options);
		return await this.invoiceService.countBy(options);
	}

	/**
	 * GET invoices by pagination params
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() options: InvoicePaginationParams<Invoice>): Promise<IPagination<IInvoice>> {
		this.invoiceService.checkIfUserCanAccessInvoiceForReadByType(options.where, options.isB2B);
		return await this.invoiceService.pagination(options);
	}

	/**
	 * GET highest invoice number
	 *
	 * @returns
	 */
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
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
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Get()
	async findAll(@Query() options: OptionParams<IInvoice>): Promise<IPagination<IInvoice>> {
		try {
			this.invoiceService.checkIfUserCanAccessInvoiceForRead(options.where);
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
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Query('data', ParseJsonPipe) data: any
	): Promise<IInvoice> {
		const { relations = [], findInput = {} } = data;
		this.invoiceService.checkIfUserCanAccessInvoiceForRead(findInput);
		return this.invoiceService.findOneByIdString(id, {
			where: findInput,
			relations
		});
	}

	/**
	 * Create new invoice from organization to customer
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new invoice from organization to customer' })
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
	@Permissions(PermissionsEnum.ORG_INVOICES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateInvoiceDTO): Promise<Invoice> {
		const userId = RequestContext.currentUserId();
		return await this.commandBus.execute(
			new InvoiceCreateCommand({
				...entity,
				createdById: userId
			})
		);
	}

	/**
	 * Create invoice from user/employee to organization
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({
		summary: 'Create invoice from user/employee to organization',
		description:
			'Creates a new invoice where the current user/employee is the sender and the organization is the recipient. This endpoint is specifically for users creating invoices for their own work/services.'
	})
	@ApiBody({
		type: CreateInvoiceDTO,
		description: 'Invoice creation data'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The invoice has been successfully created.',
		type: Invoice
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'User is not authorized to create invoices'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('own')
	@Permissions(PermissionsEnum.INVOICES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
	@UseValidationPipe({ transform: true })
	async createOwn(@Body() entity: CreateInvoiceDTO): Promise<Invoice> {
		const userId = RequestContext.currentUserId();
		return await this.commandBus.execute(
			new InvoiceCreateCommand({
				...entity,
				createdById: userId,
				fromUserId: userId
			})
		);
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
	@Permissions(
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ORG_INVOICES_EDIT,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_EDIT
	)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Body() entity: UpdateInvoiceDTO
	): Promise<Invoice> {
		await this.invoiceService.checkIfUserCanAccessInvoiceForWrite(id, true);
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
	@Permissions(
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ORG_INVOICES_EDIT,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_EDIT
	)
	@Put('/:id/estimate')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateEstimate(
		@Param('id', UUIDValidationPipe) id: IInvoice['id'],
		@Body() entity: UpdateEstimateInvoiceDTO
	) {
		await this.invoiceService.checkIfUserCanAccessInvoiceForWrite(id, true);
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
	@Permissions(
		PermissionsEnum.INVOICES_EDIT,
		PermissionsEnum.ORG_INVOICES_EDIT,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_EDIT
	)
	@Put('/:id/action')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateAction(@Param('id', UUIDValidationPipe) id: IInvoice['id'], @Body() entity: UpdateInvoiceActionDTO) {
		const canHandleInvoices = await this.invoiceService.checkIfUserCanAccessInvoiceForWrite(id, true);

		// If the user can't handle all invoices and the status is different from DRAFT or SENT then fails
		if (!canHandleInvoices && !EMPLOYEE_INVOICE_STATUSES.includes(entity.status)) {
			throw new BadRequestException(InvoiceErrors.INVALID_INVOICE);
		}
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
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Put('email/:email')
	async emailInvoice(
		@Param('email') email: string,
		@Body() body: any,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') origin: string
	): Promise<any> {
		await this.invoiceService.checkIfUserCanAccessInvoiceForReadById(body.params.invoiceId);
		return this.commandBus.execute(new InvoiceSendEmailCommand(languageCode, email, body.params, origin));
	}

	/**
	 * Generate invoice/estimate public link
	 *
	 * @param uuid
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Put('generate/:uuid')
	async generateLink(@Param('uuid', UUIDValidationPipe) uuid: IInvoice['id']): Promise<IInvoice> {
		await this.invoiceService.checkIfUserCanAccessInvoiceForReadById(uuid);
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
		await this.invoiceService.checkIfUserCanAccessInvoiceForWrite(id, true);
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
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Get('download/:uuid')
	async downloadInvoicePdf(
		@Param('uuid', UUIDValidationPipe) uuid: IInvoice['id'],
		@I18nLang() locale: LanguagesEnum,
		@Res() res: Response
	) {
		await this.invoiceService.checkIfUserCanAccessInvoiceForReadById(uuid);
		const buffer: Buffer = await this.commandBus.execute(new InvoiceGeneratePdfCommand(uuid, locale));
		if (!buffer) {
			throw new BadRequestException(InvoiceErrors.PDF_GENERATION_FAILED);
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
	@Permissions(
		PermissionsEnum.INVOICES_VIEW,
		PermissionsEnum.ORG_INVOICES_VIEW,
		PermissionsEnum.INVOICES_HANDLE,
		PermissionsEnum.ALL_ORG_VIEW
	)
	@Get('payment/download/:uuid')
	async downloadInvoicePaymentPdf(
		@Param('uuid', UUIDValidationPipe) uuid: IInvoice['id'],
		@I18nLang() locale: LanguagesEnum,
		@Res() res: Response
	) {
		await this.invoiceService.checkIfUserCanAccessInvoiceForReadById(uuid);
		const buffer = await this.commandBus.execute(new InvoicePaymentGeneratePdfCommand(uuid, locale));
		if (!buffer) {
			throw new BadRequestException(InvoiceErrors.PDF_GENERATION_FAILED);
		}
		const stream = this.invoiceService.getReadableStream(buffer);
		res.set({
			'Content-Type': 'application/pdf',
			'Content-Length': buffer.length
		});
		stream.pipe(res);
	}
}
