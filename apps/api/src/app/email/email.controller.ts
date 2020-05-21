import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Email } from './email.entity';
import { EmailService } from './email.service';

@ApiTags('Email')
@Controller()
export class EmailController extends CrudController<Email> {
	constructor(private readonly emailService: EmailService) {
		super(emailService);
	}
}
