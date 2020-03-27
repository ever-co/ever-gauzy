import { CrudController } from '../core';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Invoice')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class InvoiceController extends CrudController<Invoice> {
	constructor(private invoiceService: InvoiceService) {
		super(invoiceService);
	}
}
