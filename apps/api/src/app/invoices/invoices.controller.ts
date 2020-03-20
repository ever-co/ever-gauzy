import { CrudController } from '../core';
import { Invoice } from './invoices.entity';
import { InvoicesService } from './invoices.service';
import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Invoice')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class InvoicesController extends CrudController<Invoice> {
	constructor(private invoicesService: InvoicesService) {
		super(invoicesService);
	}
}
