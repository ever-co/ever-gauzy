import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	Param,
	Put,
	HttpCode
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { IPagination } from '../core';
import { ParseJsonPipe } from '../shared';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('Email')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
		const { relations, findInput, take } = data;

		const response = await this.emailService.findAll({
			where: findInput,
			relations,
			order: {
				createdAt: 'DESC'
			},
			take: take
		});

		response.items.forEach((email) => {
			const name = email.emailTemplate.name;
			email.emailTemplate.name = name.split('/')[0].split('-').join(' ');
		});

		return response;
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(@Param('id') id: string, @Body() entity: Email): Promise<any> {
		return this.emailService.update(id, entity);
	}
}
