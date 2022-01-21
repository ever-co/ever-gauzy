import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	Param,
	Put,
	HttpCode,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiInternalServerErrorResponse, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { IEmail, IEmailUpdateInput, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { GetEmailsQueryDto } from './dtos/get-emails-query.dto';

@ApiTags('Email')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmailController extends CrudController<Email> {
	constructor(private readonly emailService: EmailService) {
		super(emailService);
	}

	@ApiOperation({ summary: 'Find all emails.' })
	@ApiOkResponse({
		status: HttpStatus.OK,
		description: 'Found emails',
		type: Email
	})
	@ApiNotFoundResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found'
	})
	@ApiInternalServerErrorResponse({
		status : HttpStatus.INTERNAL_SERVER_ERROR,
		description: "Invalid input, This happens when a data query structure is not valid"
	})
	@Get()
	async findEmails(
		@Query("data",ParseJsonPipe,new ValidationPipe({transform : true})) queryData: GetEmailsQueryDto
	): Promise<IPagination<IEmail>> {
		const { relations, findInput, take } = queryData;
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
