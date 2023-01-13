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
	ValidationPipe
} from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { IPagination, IStatus } from '@gauzy/contracts';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CrudController, PaginationParams } from './../core/crud';
import { Status } from './status.entity';
import { StatusService } from './status.service';
import { FindAllStatusQuery } from './queries';
import { CreateStatusDTO, UpdatesStatusDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@Controller()
export class StatusController extends CrudController<Status> {

	constructor(
		private readonly queryBus: QueryBus,
		private readonly statusService: StatusService
	) {
		super(statusService);
	}

	/**
	 * GET statuses by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() params: PaginationParams<Status>
	): Promise<IPagination<IStatus>> {
		return await this.statusService.paginate(params);
	}

	/**
	 * GET statuses
	 *
	 * @param params
	 * @returns
	 */
	@Get()
	async findAll(
		@Query() params: PaginationParams<Status>
	): Promise<IPagination<IStatus>> {
		return await this.queryBus.execute(
			new FindAllStatusQuery(params)
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
	async create(
		@Body() entity: CreateStatusDTO
	): Promise<IStatus> {
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
				...entity
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