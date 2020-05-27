import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { IPagination } from '../core';
import { ParseJsonPipe } from '../shared';

@ApiTags('Email')
@Controller()
export class EmailController extends CrudController<Email> {
	constructor(private readonly emailService: EmailService) {
		super(emailService);
	}

	@ApiOperation({ summary: 'Find all emails.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found emails',
		type: Email
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found'
	})
	@Get()
	async findAllEmails(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Email>> {
		const { relations, findInput } = data;

		const response = await this.emailService.findAll({
			where: findInput,
			relations
		});

		response.items.forEach((email) => {
			const name = email.emailTemplate.name;
			email.emailTemplate.name = name
				.split('/')[0]
				.split('-')
				.join(' ');
		});

		return response;
	}
}
