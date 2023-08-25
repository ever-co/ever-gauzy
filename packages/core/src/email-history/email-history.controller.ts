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
import { IEmailHistory, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { EmailHistory } from './email-history.entity';
import { EmailHistoryService } from './email-history.service';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UpdateEmailHistoryDTO } from './dto';
import { PaginationParams } from './../core/crud';

@ApiTags('Email')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.VIEW_ALL_EMAILS)
@Controller()
export class EmailHistoryController {
	constructor(
		private readonly _emailHistoryService: EmailHistoryService
	) { }

	@ApiOperation({ summary: 'Find all sent emails under specific tenant.' })
	@ApiOkResponse({
		status: HttpStatus.OK,
		description: 'Found emails',
		type: EmailHistory
	})
	@ApiNotFoundResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found'
	})
	@ApiInternalServerErrorResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: "Invalid input, The response body may contain clues as to what went wrong"
	})
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<EmailHistory>
	): Promise<IPagination<IEmailHistory>> {
		try {
			return await this._emailHistoryService.findAll(params);
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: IEmailHistory['id'],
		@Body() entity: UpdateEmailHistoryDTO
	): Promise<IEmailHistory | UpdateResult> {
		try {
			return await this._emailHistoryService.update(id, entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
