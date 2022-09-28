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
	ValidationPipe,
	UseInterceptors,
	BadRequestException
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiInternalServerErrorResponse,
	ApiOkResponse,
	ApiNotFoundResponse
} from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { IEmail, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UpdateEmailDTO } from './dto';
import { PaginationParams } from './../core/crud';
import { TransformInterceptor } from './../core/interceptors';

@ApiTags('Email')
@UseInterceptors(TransformInterceptor)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.VIEW_ALL_EMAILS)
@Controller()
export class EmailController {
	constructor(
		private readonly emailService: EmailService
	) {}

	@ApiOperation({ summary: 'Find all emails under specific tenant.' })
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
		description: "Invalid input, The response body may contain clues as to what went wrong"
	})
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<Email>
	): Promise<IPagination<IEmail>> {
		try {
			return await this.emailService.findAll(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
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
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateEmailDTO
	): Promise<IEmail | UpdateResult> {
		return await this.emailService.update(id, entity);
	}
}
