import { Controller, UseGuards, Query, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsEnum, IInvoiceEstimateHistory, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';

@ApiTags('InvoiceEstimateHistory')
@Controller('/invoice-estimate-history')
export class InvoiceEstimateHistoryController extends CrudController<InvoiceEstimateHistory> {
	constructor(private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService) {
		super(invoiceEstimateHistoryService);
	}

	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IInvoiceEstimateHistory>> {
		const { relations = [], findInput = null } = data;
		return this.invoiceEstimateHistoryService.findAll({
			where: findInput,
			relations
		});
	}
}
