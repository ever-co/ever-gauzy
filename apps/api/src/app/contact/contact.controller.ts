import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Contact } from './contact.entity';
import { ContactService } from './contact.service';

@ApiTags('Contact')
@Controller()
export class ContactController extends CrudController<Contact> {
	constructor(private readonly contactService: ContactService) {
		super(contactService);
	}
}
