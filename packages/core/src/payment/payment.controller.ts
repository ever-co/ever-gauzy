import { CrudController, IPagination } from '../core';
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
	Delete,
	Req
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';
import {
	IGetPaymentInput,
	IPayment,
	IPaymentReportData,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { ParseJsonPipe } from '../shared';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { PaymentMapService } from './payment.map.service';
import { I18nLang } from 'nestjs-i18n';

@ApiTags('Payment')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class PaymentController extends CrudController<Payment> {
	constructor(
		private paymentService: PaymentService,
		private paymentMapService: PaymentMapService
	) {
		super(paymentService);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PAYMENT_VIEW)
	@Get()
	async findAllPayments(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IPayment>> {
		const { relations = [], findInput = null } = data;
		return this.paymentService.findAll({
			where: findInput,
			relations
		});
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EXPENSES_VIEW)
	@Get('report')
	async getPaymentReport(
		@Query() request: IGetPaymentInput
	): Promise<IPaymentReportData[]> {
		const reports = await this.paymentService.getPayments(request);

		let response: IPaymentReportData[] = [];
		if (request.groupBy === 'date') {
			response = this.paymentMapService.mapByDate(reports);
		} else if (request.groupBy === 'client') {
			response = this.paymentMapService.mapByClient(reports);
		} else if (request.groupBy === 'project') {
			response = this.paymentMapService.mapByProject(reports);
		}
		return response;
	}

	@ApiOperation({ summary: 'Payment Report daily chart' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('report/chart-data')
	async getDailyReportChartData(@Query() options: IGetPaymentInput) {
		return this.paymentService.getDailyReportChartData(options);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	@Post()
	async createPayment(@Body() entity: IPayment): Promise<any> {
		return this.paymentService.create(entity);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	@Post('receipt')
	async sendReceipt(
		@Req() request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<any> {
		return this.paymentService.sendReceipt(
			languageCode,
			request.body.params,
			request.get('Origin')
		);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	@Put(':id')
	async updatePayment(
		@Param('id') id: string,
		@Body() entity: IPayment
	): Promise<any> {
		return this.paymentService.create({
			id,
			...entity
		});
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	@Delete(':id')
	async deleteTask(@Param('id') id: string): Promise<any> {
		return this.paymentService.delete(id);
	}
}
