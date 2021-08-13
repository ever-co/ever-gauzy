import { CrudController } from './../core/crud';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards, Query, Get } from '@nestjs/common';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { PermissionsEnum, IInvoiceEstimateHistory, IPagination } from '@gauzy/contracts';
import { ParseJsonPipe } from './../shared/pipes';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';

@ApiTags('InvoiceEstimateHistory')
@Controller()
export class InvoiceEstimateHistoryController extends CrudController<InvoiceEstimateHistory> {
	constructor(
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService
	) {
		super(invoiceEstimateHistoryService);
	}

	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAllHistories(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IInvoiceEstimateHistory>> {
		const { relations = [], findInput = null } = data;
		return this.invoiceEstimateHistoryService.findAll({
			where: findInput,
			relations
		});
	}
}
