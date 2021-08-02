import { CrudController, IPagination } from '../core';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemService } from './invoice-item.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	Controller,
	UseGuards,
	Get,
	Query,
	HttpStatus,
	Post,
	Body,
	Param
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IInvoiceItem, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { CommandBus } from '@nestjs/cqrs';
import { InvoiceItemBulkCreateCommand } from './commands';

@ApiTags('InvoiceItem')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class InvoiceItemController extends CrudController<InvoiceItem> {
	constructor(
		private invoiceItemService: InvoiceItemService,
		private readonly commandBus: CommandBus
	) {
		super(invoiceItemService);
	}

	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IInvoiceItem>> {
		const { relations = [], findInput = null } = data;
		return this.invoiceItemService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Create invoice item in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Invoice item have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Post('/createBulk/:invoiceId')
	async createBulk(
		@Param('invoiceId', UUIDValidationPipe) invoiceId: string,
		@Body() input: IInvoiceItemCreateInput[]
	): Promise<any> {
		return this.commandBus.execute(
			new InvoiceItemBulkCreateCommand(invoiceId, input)
		);
	}
}
