import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	Controller,
	UseGuards,
	Query,
	Get,
	HttpCode,
	HttpStatus,
	Put,
	Param,
	Body,
	Post,
	BadRequestException,
	Headers
} from '@nestjs/common';
import { I18nLang } from 'nestjs-i18n';
import {
	IPagination,
	IPayment,
	IPaymentReportData,
	LanguagesEnum,
	PermissionsEnum,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../core';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';
import { PaymentMapService } from './payment.map.service';
import { CreatePaymentDTO, UpdatePaymentDTO } from './dto';
import { PaymentReportQueryDTO } from './dto/query';

@ApiTags('Payment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
@Controller('/payments')
export class PaymentController extends CrudController<Payment> {
	constructor(
		private readonly paymentService: PaymentService,
		private readonly paymentMapService: PaymentMapService
	) {
		super(paymentService);
	}

	/**
	 * GET payments report
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Payments report.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found reports'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PAYMENT_VIEW)
	@Get('/report')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getPaymentReport(@Query() options: PaymentReportQueryDTO): Promise<IPaymentReportData[]> {
		const reports = await this.paymentService.getPayments(options);
		let response: IPaymentReportData[] = [];
		if (options.groupBy === ReportGroupFilterEnum.date) {
			response = this.paymentMapService.mapByDate(reports);
		} else if (options.groupBy === ReportGroupFilterEnum.client) {
			response = this.paymentMapService.mapByClient(reports);
		} else if (options.groupBy === ReportGroupFilterEnum.project) {
			response = this.paymentMapService.mapByProject(reports);
		}
		return response;
	}

	/**
	 * GET payments report daily chart data
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Payment Report daily chart' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PAYMENT_VIEW)
	@Get('/report/charts')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getDailyReportCharts(@Query() options: PaymentReportQueryDTO) {
		return this.paymentService.getDailyReportCharts(options);
	}

	/**
	 * SEND receipt
	 *
	 * @param request
	 * @param languageCode
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('/receipt')
	async sendReceipt(
		@Body() body,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') origin: string
	): Promise<any> {
		const { invoice, payment } = body.params;
		return await this.paymentService.sendReceipt(languageCode, invoice, payment, origin);
	}

	/**
	 * GET payment records by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_PAYMENT_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Payment>): Promise<IPagination<IPayment>> {
		return await this.paymentService.pagination(params);
	}

	/**
	 * GET payment records
	 *
	 * @param data
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_PAYMENT_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Payment>): Promise<IPagination<IPayment>> {
		return await this.paymentService.findAll(params);
	}

	/**
	 * CREATE new payment record
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePaymentDTO): Promise<IPayment> {
		return await this.paymentService.create(entity);
	}

	/**
	 * UPDATE existing payment record
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdatePaymentDTO): Promise<IPayment> {
		try {
			return await this.paymentService.create({
				id,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
