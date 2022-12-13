import { QueryBus } from '@nestjs/cqrs';
import { Controller, Delete, ForbiddenException, Get, Param, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { IPagination, IStatus } from '@gauzy/contracts';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CrudController, PaginationParams } from './../core/crud';
import { Status } from './status.entity';
import { StatusService } from './status.service';
import { FindAllStatusQuery } from './queries';

@UseGuards(TenantPermissionGuard)
@Controller()
export class StatusController extends CrudController<Status> {

	constructor(
		private readonly queryBus: QueryBus,
		private readonly statusService: StatusService
	) {
		super(statusService);
	}

	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() options: PaginationParams<Status>
	): Promise<IPagination<IStatus>> {
		return await this.queryBus.execute(
			new FindAllStatusQuery(options)
		);
	}

	/**
	 * DELETE role by id
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