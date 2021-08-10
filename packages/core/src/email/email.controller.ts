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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IEmail, IEmailUpdateInput, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('Email')
@UseGuards(TenantPermissionGuard)
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEmail>> {
		const { relations, findInput, take } = data;
		return await this.emailService.findAll({
			where: findInput,
			relations,
			order: {
				createdAt: 'DESC'
			},
			take: take
		});
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
	async update(
		@Param('id', UUIDValidationPipe) id: string, 
		@Body() entity: IEmailUpdateInput
	): Promise<any> {
		return await this.emailService.update(id, entity);
	}
}
