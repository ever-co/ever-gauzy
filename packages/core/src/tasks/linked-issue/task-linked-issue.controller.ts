import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ID, ITaskLinkedIssue, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import { Permissions } from '../../shared/decorators';
import { CrudController } from '../../core/crud';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TaskLinkedIssueService } from './task-linked-issue.service';
import { CreateTaskLinkedIssueDTO, UpdateTaskLinkedIssueDTO } from './dto';

@ApiTags('Linked Issue')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class TaskLinkedIssueController extends CrudController<TaskLinkedIssue> {
	constructor(protected readonly taskLinkedIssueService: TaskLinkedIssueService) {
		super(taskLinkedIssueService);
	}

	/**
	 * Create new Linked Issue
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTaskLinkedIssueDTO): Promise<ITaskLinkedIssue> {
		return await this.taskLinkedIssueService.create(entity);
	}

	/**
	 * Update existing Linked Issue
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTaskLinkedIssueDTO
	): Promise<ITaskLinkedIssue> {
		return await this.taskLinkedIssueService.create({
			...entity,
			id
		});
	}
}
