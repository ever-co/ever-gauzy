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
	Get
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum, Invoice as IInvoice } from '@gauzy/models';

@ApiTags('Invoice')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class InvoiceController extends CrudController<Invoice> {
	constructor(private invoiceService: InvoiceService) {
		super(invoiceService);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.POLICY_VIEW)
	@Get()
	async findAllInvoices(
		@Query('data') data: string
	): Promise<IPagination<IInvoice>> {
		const { relations, findInput } = JSON.parse(data);

		return this.invoiceService.getAllInvoices({
			where: findInput,
			relations
		});
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id')
	async updateInvoice(
		@Param('id') id: string,
		@Body() entity: IInvoice,
		...options: any[]
	): Promise<IInvoice> {
		return this.invoiceService.update(id, entity);
	}
}
