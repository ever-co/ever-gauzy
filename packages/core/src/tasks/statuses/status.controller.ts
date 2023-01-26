import { QueryBus } from '@nestjs/cqrs';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { IPagination, IStatus } from '@gauzy/contracts';
import { UUIDValidationPipe } from './../../shared/pipes';
import { TenantPermissionGuard } from './../../shared/guards';
import { StatusService } from './status.service';
import { FindStatusesQuery } from './queries';
import { CreateStatusDTO, StatusQuerDTO, UpdatesStatusDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@Controller()
export class StatusController {

	constructor(
		private readonly queryBus: QueryBus,
		private readonly statusService: StatusService
	) {}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findAllStatuses(
		@Query() params: StatusQuerDTO
	): Promise<IPagination<IStatus>> {
		return await this.queryBus.execute(
			new FindStatusesQuery(params)
		);
	}

	/**
	 * CREATED new status
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async create(@Body() entity: CreateStatusDTO): Promise<IStatus> {
		try {
			return await this.statusService.create(entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * UPDATED existing status by id
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async update(
		@Param('id', UUIDValidationPipe) id: IStatus['id'],
		@Body() entity: UpdatesStatusDTO
	): Promise<IStatus> {
		try {
			return await this.statusService.create({
				id,
				...entity,
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * DELETE status by id
	 *
	 * @param id
	 * @returns
	 */
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: IStatus['id']
	): Promise<DeleteResult> {
		try {
			return await this.statusService.delete(id);
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
