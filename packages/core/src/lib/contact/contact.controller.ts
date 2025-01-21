import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IContact, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { ParseJsonPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { Contact } from './contact.entity';

import { ContactService } from './contact.service';
@ApiTags('Contact')
@UseGuards(TenantPermissionGuard)
@Controller('/contact')
export class ContactController extends CrudController<Contact> {
	constructor(private readonly contactService: ContactService) {
		super(contactService);
	}

	@ApiOperation({
		summary: 'Find all contacts.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found contact',
		type: Contact
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IContact>> {
		const { relations, findInput } = data;
		return this.contactService.findAll({ where: findInput, relations });
	}
}
