import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ITaskEstimation, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { TaskEstimation } from './task-estimation.entity';
import { TaskEstimationService } from './task-estimation.service';
import { Permissions } from './../../shared/decorators';
import { CrudController } from './../../core/crud';
import { CreateTaskEstimationDTO } from './dto';

@ApiTags('Task Estimation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class TaskEstimationController extends CrudController<TaskEstimation> {
	constructor(
		protected readonly taskEstimationService: TaskEstimationService
	) {
		super(taskEstimationService);
	}

	/**
	 * Create new Linked Issue
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_ADD)
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async create(
		@Body() entity: CreateTaskEstimationDTO
	): Promise<ITaskEstimation> {
		return await this.taskEstimationService.create(entity);
	}
}
