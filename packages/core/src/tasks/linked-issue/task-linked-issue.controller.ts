import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ITaskLinkedIssue, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TaskLinkedIssueService } from './task-linked-issue.service';
import { Permissions } from './../../shared/decorators';
import { CrudController } from './../../core/crud';
import { CreateTaskLinkedIssueDTO } from './dto';

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TASK_ADD)
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async create(@Body() entity: CreateTaskLinkedIssueDTO): Promise<ITaskLinkedIssue> {
		return await this.taskLinkedIssueService.create(entity);
	}
}
