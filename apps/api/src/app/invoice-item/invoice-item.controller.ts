import { CrudController } from '../core';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemService } from './invoice-item.service';
import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('InvoiceItem')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class InvoiceItemController extends CrudController<InvoiceItem> {
	constructor(private invoiceItemService: InvoiceItemService) {
		super(invoiceItemService);
	}
}
