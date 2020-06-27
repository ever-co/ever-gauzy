import {
	Controller,
	Get,
	HttpStatus,
	Query,
	UseGuards
	} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { Contact } from './contact.entity';
import { ContactService } from './contact.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Contact')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ContactsController extends CrudController<Contact> {
	constructor(
		private readonly contactService: ContactService,
		private readonly commandBus: CommandBus
	) {
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
	async getAllContacts(
		@Query('data') data: string
	): Promise<IPagination<Contact>> {
		const { relations, findInput } = JSON.parse(data);
		return this.contactService.findAll({ where: findInput, relations });
	}
}
