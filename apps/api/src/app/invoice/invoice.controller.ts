import { CrudController, IPagination } from '../core';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { ApiTags } from '@nestjs/swagger';
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
	Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import {
	PermissionsEnum,
	Invoice as IInvoice,
	LanguagesEnum,
} from '@gauzy/models';
import { ParseJsonPipe } from '../shared';
import { I18nLang } from 'nestjs-i18n';
import { EmailService } from '../email';

@ApiTags('Invoice')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class InvoiceController extends CrudController<Invoice> {
	constructor(
		private invoiceService: InvoiceService,
		private readonly emailService: EmailService
	) {
		super(invoiceService);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAllInvoices(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IInvoice>> {
		const { relations = [], findInput = null } = data;

		return this.invoiceService.findAll({
			where: findInput,
			relations,
		});
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('highest')
	async findHighestInvoiceNumber(): Promise<IPagination<IInvoice>> {
		return this.invoiceService.getHighestInvoiceNumber();
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get(':id')
	async findByIdWithRelations(
		@Param('id') id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IInvoice> {
		const { relations = [] } = data;

		return this.invoiceService.findOne(id, {
			relations,
		});
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id')
	async updateInvoice(
		@Param('id') id: string,
		@Body() entity: IInvoice
	): Promise<any> {
		return this.invoiceService.create({
			id,
			...entity,
		});
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Put('email/:email')
	async emailInvoice(
		@Param('email') email: string,
		@Req() request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<any> {
		return this.emailService.emailInvoice(
			languageCode,
			email,
			request.body.params.isEstimate,
			request.get('Origin')
		);
	}
}
