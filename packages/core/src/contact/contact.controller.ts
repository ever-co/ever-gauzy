import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Contact } from './contact.entity';
import { ContactService } from './contact.service';
import { ParseJsonPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('Contact')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ContactController extends CrudController<Contact> {
	constructor(private readonly contactService: ContactService) {
		super(contactService);
	}

	@ApiOperation({
		summary: 'Find all contacts.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found contact recurring expense',
		type: Contact
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async getAllContact(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Contact>> {
		const { relations, findInput } = data;
		return this.contactService.findAll({ where: findInput, relations });
	}
}
