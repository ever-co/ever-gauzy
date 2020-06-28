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
	Post
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import {
	PermissionsEnum,
	Invoice as IInvoice,
	LanguagesEnum
} from '@gauzy/models';
import { ParseJsonPipe } from '../shared';
import { I18nLang } from 'nestjs-i18n';

@ApiTags('Invoice')
@Controller()
export class InvoiceController extends CrudController<Invoice> {
	constructor(private invoiceService: InvoiceService) {
		super(invoiceService);
	}

	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAllInvoices(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IInvoice>> {
		const { relations = [], findInput = null } = data;

		return this.invoiceService.findAll({
			where: findInput,
			relations
		});
	}

	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('highest')
	async findHighestInvoiceNumber(): Promise<IPagination<IInvoice>> {
		return this.invoiceService.getHighestInvoiceNumber();
	}

	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get(':id')
	async findByIdWithRelations(
		@Param('id') id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IInvoice> {
		const { relations = [] } = data;

		return this.invoiceService.findOne(id, {
			relations
		});
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id')
	async updateInvoice(
		@Param('id') id: string,
		@Body() entity: IInvoice
	): Promise<any> {
		return this.invoiceService.create({
			id,
			...entity
		});
	}

	@Put('estimate/:id')
	async updateWithoutGuard(
		@Param('id') id: string,
		@Body() entity: IInvoice
	): Promise<any> {
		return this.invoiceService.create({
			id,
			...entity
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
		return this.invoiceService.sendEmail(
			languageCode,
			email,
			request.body.params.base64,
			request.body.params.invoiceNumber,
			request.body.params.invoiceId,
			request.body.params.isEstimate,
			request.get('Origin')
		);
	}
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(AuthGuard('jwt'), PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Post()
	async create(
		@Body() entity: IInvoice,
		...options: any[]
	): Promise<Invoice> {
		return this.invoiceService.create(entity);
	}
}
