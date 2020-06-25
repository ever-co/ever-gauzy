import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Query,
	UseGuards,
	Post
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { Contacts } from './contacts.entity';
import { ContactsService } from './contacts.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Contacts')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ContactsController extends CrudController<Contacts> {
	constructor(
		private readonly contactsService: ContactsService,
		private readonly commandBus: CommandBus
	) {
		super(contactsService);
	}

	
	@ApiOperation({
		summary: 'Find all contacts.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found contact recurring expense',
		type: Contacts
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async getAllContacts(@Query('data') data: string): Promise<IPagination<Contacts>> {
		const { relations, findInput } = JSON.parse(data);
		return this.contactsService.findAll({ where: findInput, relations });
	}

}
