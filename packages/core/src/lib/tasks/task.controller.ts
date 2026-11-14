import {
	Controller,
	HttpStatus,
	Get,
	Query,
	HttpCode,
	Put,
	Param,
	Body,
	UseGuards,
	Post,
	Delete,
	NotFoundException,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import {
	PermissionsEnum,
	ITask,
	IPagination,
	ID,
	ITaskBulkUpdateOutcome,
	ITaskCreateInput,
	ITaskReferenceResolution,
	ITaskUpdateInput,
	TaskBuiltInViewEnum
} from '@gauzy/contracts';
import {
	BulkExecutor,
	BulkOperation,
	BulkResult,
	IBulkCreateRequest,
	applyAsSingleCreate,
	bulkCreateRequest,
	bulkOptionsOf,
	singleRouteBody
} from './../api';
import { Idempotent } from './../idempotency/idempotent.decorator';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { AbstractValidationPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskCreateCommand, TaskUpdateCommand } from './commands';
import {
	CreateTaskDTO,
	GetTaskByIdDTO,
	TaskDateFilterInputDTO,
	TaskByNumberParamsDTO,
	TaskByNumberQueryDTO,
	TaskBuiltInViewQueryDTO,
	TaskBulkUpdateDTO,
	TaskMaxNumberQueryDTO,
	TaskMemberDTO,
	TaskQueryDTO,
	TaskTrashQueryDTO,
	TaskReferenceResolveDTO,
	UpdateTaskDTO,
	UpdateTaskStatusDTO
} from './dto';
import { TaskViewsEnabledGuard } from './task-views-enabled';
import { TaskTrashEnabledGuard } from './task-trash-enabled';
import { isBuiltInView } from './built-in-views';

@ApiTags('Tasks')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/tasks')
export class TaskController extends CrudController<Task> {
	constructor(
		private readonly taskService: TaskService,
		private readonly commandBus: CommandBus,
		private readonly bulkExecutor: BulkExecutor
	) {
		super(taskService);
	}

	/**
	 * GET task count
	 *
	 * @param options The filter options for counting tasks.
	 * @returns The total number of tasks.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/count')
	@UseValidationPipe()
	@ApiOperation({ summary: 'Get the total count of tasks.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Task count retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	async getCount(@Query() options: CountQueryDTO<Task>): Promise<number> {
		return this.taskService.countBy(options);
	}

	/**
	 * GET tasks by pagination
	 *
	 * @param params The pagination and filter parameters.
	 * @returns A paginated list of tasks.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	@ApiOperation({ summary: 'Get tasks by pagination.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	async pagination(@Query() params: TaskQueryDTO): Promise<IPagination<ITask>> {
		return this.taskService.pagination(params);
	}

	/**
	 * GET maximum task number
	 *
	 * @param options The query options to filter the tasks by project.
	 * @returns The maximum task number for a given project.
	 */
	@ApiOperation({ summary: 'Get the maximum task number by project.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Maximum task number retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/max-number')
	@UseValidationPipe()
	async getMaxTaskNumberByProject(@Query() options: TaskMaxNumberQueryDTO): Promise<number> {
		return this.taskService.getMaxTaskNumberByProject(options);
	}

	/**
	 * GET the trash: soft-deleted tasks of the caller's organization, most recently deleted first, optionally of one
	 * team or project. With the delete grants (`ALL_ORG_EDIT`, `ORG_TASK_DELETE`) the whole organization's; with
	 * `ORG_TASK_EDIT` alone, the trash of a team the caller manages, named by `organizationTeamId`. Behind
	 * `GAUZY_TASK_TRASH_ENABLED` (404 otherwise, the probe a client reads). Declared before `/:id`.
	 *
	 * @param query The organization, the team or project, the search and the page.
	 */
	@ApiOperation({ summary: 'List the soft-deleted tasks (the trash).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The trashed tasks, most recently deleted first.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Without the delete grants, name a team you manage.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The trash is not enabled on this server.' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE, PermissionsEnum.ORG_TASK_EDIT)
	@UseGuards(TaskTrashEnabledGuard)
	@Get('/trash')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findTrash(@Query() query: TaskTrashQueryDTO): Promise<IPagination<ITask>> {
		return this.taskService.findTrash(query);
	}

	/**
	 * GET my tasks
	 *
	 * @param params The filter and pagination options for retrieving tasks.
	 * @returns A paginated list of tasks assigned to the current user.
	 */
	@ApiOperation({ summary: 'Get tasks assigned to the current user.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/me')
	@UseValidationPipe({ transform: true })
	async findMyTasks(@Query() params: BaseQueryDTO<Task>): Promise<IPagination<ITask>> {
		return this.taskService.getMyTasks(params);
	}

	/**
	 * GET employee tasks
	 *
	 * @param params The filter and pagination options for retrieving employee tasks.
	 * @returns A paginated list of tasks assigned to the specified employee.
	 */
	@ApiOperation({ summary: 'Get tasks assigned to a specific employee.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/employee')
	@UseValidationPipe({ transform: true })
	async findEmployeeTask(@Query() params: TaskQueryDTO): Promise<IPagination<ITask>> {
		return this.taskService.getEmployeeTasks(params);
	}

	/**
	 * GET my team tasks
	 *
	 * @param params The filter and pagination options for retrieving team tasks.
	 * @returns A paginated list of tasks assigned to the current user's team.
	 */
	@ApiOperation({ summary: "Get tasks assigned to the current user's team." })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/team')
	@UseValidationPipe({ transform: true })
	async findTeamTasks(@Query() params: TaskQueryDTO): Promise<IPagination<ITask>> {
		return this.taskService.findTeamTasks(params);
	}

	/**
	 * GET module tasks
	 *
	 * @param params The filter and pagination options for retrieving module tasks.
	 * @returns A paginated list of tasks by module.
	 */
	@ApiOperation({ summary: 'Get tasks by module.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/module')
	@UseValidationPipe({ transform: true })
	async findModuleTasks(@Query() params: TaskQueryDTO): Promise<IPagination<ITask>> {
		return this.taskService.findModuleTasks(params);
	}

	/**
	 * Retrieves tasks based on the provided date filters for startDate and dueDate.
	 *
	 * @function getTasksByDateFilters
	 * @param {TaskDateFilterInputDTO} params - The DTO containing the date filters for the tasks.
	 */
	@ApiOperation({ summary: 'Get tasks by start and due dates filters.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/filter-by-date')
	@UseValidationPipe({ transform: true })
	async getTasksByDateFilters(@Query() params: TaskDateFilterInputDTO): Promise<IPagination<ITask>> {
		return this.taskService.getTasksByDateFilters(params);
	}

	/**
	 * GET view tasks
	 *
	 * @param params The filter options for retrieving view tasks.
	 * @returns A paginated list of tasks by view filters.
	 */
	@ApiOperation({ summary: 'Get tasks by view query filter.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/view/:id')
	@UseValidationPipe({ transform: true })
	async findTasksByViewQuery(@Param('id', UUIDValidationPipe) viewId: ID): Promise<IPagination<ITask>> {
		return this.taskService.findTasksByViewQuery(viewId);
	}

	/**
	 * GET a built-in view: `mine`, `this-week`, `overdue` or `due-soon`, computed by the platform for the caller
	 * in the caller's time zone. Behind `GAUZY_TASK_VIEWS_ENABLED` (404 otherwise).
	 *
	 * @param key The view.
	 * @param query The organization, the time zone and the page.
	 * @returns The caller's tasks of that view.
	 */
	@ApiOperation({ summary: 'Get the tasks of a built-in view (mine, this-week, overdue, due-soon).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such view, or the extensions are off.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@UseGuards(TaskViewsEnabledGuard)
	@Get('/built-in/:key')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findBuiltInView(@Param('key') key: string, @Query() query: TaskBuiltInViewQueryDTO): Promise<IPagination<ITask>> {
		if (!isBuiltInView(key)) {
			throw new NotFoundException(`No built-in view "${key}".`);
		}
		return this.taskService.findBuiltInView(key as TaskBuiltInViewEnum, query);
	}

	/**
	 * POST a bulk update: one change for up to 100 tasks (`taskIds` + `changes`), or a change per task (`items`,
	 * which is how an undo sends the previous values back). Every task is updated by the same command as
	 * `PUT /tasks/:id` (activity, notifications and sync events per task); the answer holds one result per task
	 * with the previous values. Behind `GAUZY_TASK_VIEWS_ENABLED` (404 otherwise).
	 *
	 * @param input The tasks and the changes.
	 * @returns One result per task, with the previous values.
	 */
	@ApiOperation({ summary: 'Change many tasks in one request, with per-task results and undo data.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Applied, with one result per task.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Nothing to change, both forms sent, or over the limit (BULK_LIMIT_EXCEEDED).' })
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@UseGuards(TaskViewsEnabledGuard)
	@Post('/bulk-update')
	@UseValidationPipe({ whitelist: true, transform: true })
	async bulkUpdate(@Body() input: TaskBulkUpdateDTO): Promise<ITaskBulkUpdateOutcome> {
		return this.taskService.bulkUpdate(input, (id, update) => this.commandBus.execute(new TaskUpdateCommand(id, update as ITaskUpdateInput)));
	}

	/**
	 * POST references to resolve: `KEY-number` identifiers (`API-42`) to the tasks they name, by the project's
	 * key, its former keys, or the key derived from its name. Behind `GAUZY_TASK_VIEWS_ENABLED` (404 otherwise).
	 *
	 * @param input The organization and the references.
	 * @returns One resolution per reference.
	 */
	@ApiOperation({ summary: 'Resolve KEY-number references to tasks.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'One resolution per reference.' })
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@UseGuards(TaskViewsEnabledGuard)
	@Post('/resolve-references')
	@UseValidationPipe({ whitelist: true })
	async resolveReferences(@Body() input: TaskReferenceResolveDTO): Promise<ITaskReferenceResolution[]> {
		return this.taskService.resolveReferences(input);
	}

	/**
	 * GET one task by its human key: the project prefix and the number (`FUL-12`).
	 *
	 * The organization is the query's own member and is checked against the caller's memberships; the
	 * project is optional and is what disambiguates a prefix two projects share — without it, a key that
	 * names two tasks is refused rather than answered with whichever one the store returned first.
	 *
	 * @param params The prefix and the number.
	 * @param query The organization and, optionally, the project.
	 * @returns The task.
	 */
	@ApiOperation({ summary: 'Get a task by its project prefix and number.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Task retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No task carries that key in this organization.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The key names several tasks; state the project.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/by-number/:prefix/:number')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findByNumber(
		@Param() params: TaskByNumberParamsDTO,
		@Query() query: TaskByNumberQueryDTO
	): Promise<ITask> {
		return this.taskService.findByNumber({
			tenantId: query.tenantId,
			organizationId: query.organizationId,
			projectId: query.projectId,
			prefix: params.prefix,
			number: params.number
		});
	}

	/**
	 * GET task by ID
	 *
	 * @param id The ID of the task.
	 * @param params The options for task retrieval.
	 * @returns The task with the specified ID.
	 */
	@ApiOperation({ summary: 'Get task by ID.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Task retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() params: GetTaskByIdDTO): Promise<Task> {
		return this.taskService.findById(id, params);
	}

	/**
	 * GET tasks by employee
	 *
	 * @param employeeId The ID of the employee.
	 * @param params The pagination and filter parameters for tasks.
	 * @returns A list of tasks assigned to the specified employee.
	 */
	@ApiOperation({ summary: 'Get tasks assigned to a specific employee.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No records found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/employee/:id')
	@UseValidationPipe()
	async getAllTasksByEmployee(@Param('id') employeeId: ID, @Query() params: TaskQueryDTO): Promise<ITask[]> {
		return this.taskService.getAllTasksByEmployee(employeeId, params);
	}

	/**
	 * GET all tasks
	 *
	 * @param params The pagination and filter parameters for retrieving tasks.
	 * @returns A paginated list of all tasks.
	 */
	@ApiOperation({ summary: 'Get all tasks.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No tasks found.' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: TaskQueryDTO): Promise<IPagination<ITask>> {
		return this.taskService.findAll(params);
	}

	/**
	 * POST create a task
	 *
	 * @param entity The data for creating the task.
	 * @returns The created task.
	 */
	@ApiOperation({ summary: 'Create a new task.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The task has been successfully created.'
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTaskDTO): Promise<ITask> {
		return this.commandBus.execute(new TaskCreateCommand(entity));
	}

	/**
	 * POST tasks in bulk
	 *
	 * One request files many tasks and answers one outcome per item. The batch is the platform's —
	 * `@BulkOperation` declares what this route accepts, the executor is configured from that declaration,
	 * authorises the whole request once and refuses a batch it cannot read before writing anything.
	 *
	 * **Each item is `POST /tasks`**: its body runs through that route's own validation pipe and then through
	 * that route's handler, which dispatches `TaskCreateCommand` — so every task is numbered by the handler
	 * that numbers a single task, from the highest number its project holds at the moment the item is
	 * applied. The executor applies the items one after another, never two at once, so each item reads the
	 * number the item before it took: the numbers a batch hands out are the numbers the same tasks filed one
	 * by one would have, with no two items racing for the same one.
	 *
	 * The permission is the create route's — either of its two grants admits the caller — on the guard and
	 * on the declaration alike. A batch files what it can and reports the rest; **`atomic: true` is refused
	 * before item 0** (`BULK_ATOMIC_UNSUPPORTED`, declared `atomic: false`): each item runs the single
	 * create, which writes through its own repositories, so the batch cannot be rolled back as one. The route
	 * declares no dry run and no write mode either (see `bulkCreateRequest`).
	 *
	 * @param request The batch: the items, each the body `POST /tasks` takes.
	 * @returns What applied, what did not, and the counts derived from both.
	 */
	@ApiOperation({ summary: 'Create tasks in bulk' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The batch was applied, with one outcome per item' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request or an item could not be read, or it asked for "atomic" (BULK_ATOMIC_UNSUPPORTED)'
	})
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'BULK_LIMIT_EXCEEDED' })
	@ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'BULK_ALL_ITEMS_FAILED' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Idempotent({ scope: 'task.bulk', required: false, resourceType: 'task' })
	@BulkOperation({
		resource: 'task',
		// The platform's cap for every resource but the price and stock matrices: an item is one task row
		// with its member links, numbered by one read of its project's highest number.
		maxItems: 200,
		permission: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD],
		// Each item is the single create, which writes through its own repositories: no batch transaction.
		atomic: false
	})
	@Post('/bulk')
	async bulk(@Body() request: IBulkCreateRequest<ITaskCreateInput>): Promise<BulkResult<ITaskCreateInput>> {
		const batch = bulkCreateRequest(request);

		return await this.bulkExecutor.execute<ITaskCreateInput>(
			batch,
			(item, context) => applyAsSingleCreate(item, context, (body) => this.createAsSingleRoute(body)),
			bulkOptionsOf(TaskController, 'bulk')
		);
	}

	/**
	 * Files one item of a batch exactly as `POST /tasks` files its body: through the route's own pipes, then
	 * through the route's handler.
	 *
	 * @param body The item, as the single route's body.
	 * @returns The task filed.
	 */
	private async createAsSingleRoute(body: ITaskCreateInput): Promise<ITask> {
		return await this.create(await singleRouteBody<CreateTaskDTO>(TaskController, 'create')(body));
	}

	/**
	 * PUT update an existing task
	 *
	 * @param id The ID of the task to update.
	 * @param entity The data for updating the task.
	 * @returns The updated task.
	 */
	@ApiOperation({ summary: 'Update an existing task.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The task has been successfully updated.'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateTaskDTO): Promise<ITask> {
		return this.commandBus.execute(new TaskUpdateCommand(id, entity));
	}

	/**
	 * PUT move a task to another status, changing nothing else
	 *
	 * The full update needs the title, so a client that changes only the status (a card dropped on
	 * another column of the project board) would send back a title it read earlier and undo a rename.
	 *
	 * @param id The ID of the task to move.
	 * @param input The status to move it to.
	 * @returns The updated task.
	 */
	@ApiOperation({ summary: "Update a task's status." })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: "The task's status has been successfully updated."
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put('/:id/status')
	@UseValidationPipe({ whitelist: true })
	async updateStatus(@Param('id', UUIDValidationPipe) id: ID, @Body() input: UpdateTaskStatusDTO): Promise<ITask> {
		const { organizationId, status, taskStatusId } = input;
		// The organization is one of the caller's (the DTO checks it) and must be the task's: the guards check
		// the tenant only, so a member of one organization could otherwise move a task of another in the same
		// tenant. A task of another organization reads as not found, as one of another tenant does.
		const task = await this.taskService.findOneByIdString(id);
		if (!task || task.organizationId !== organizationId) {
			throw new NotFoundException('The requested record was not found');
		}
		// Only the status reaches the update, a partial one as the service takes it: the organization is the
		// request's context and is never written.
		return this.commandBus.execute(new TaskUpdateCommand(id, { status, taskStatusId } as ITaskUpdateInput));
	}

	/**
	 * DELETE task by ID, for good: a live task or one in the trash. A task other records still point at stays (409).
	 *
	 * @param id The ID of the task to delete.
	 * @returns The result of the deletion.
	 */
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE, PermissionsEnum.ORG_TASK_EDIT)
	@Delete('/:id')
	@ApiOperation({ summary: 'Delete a task by ID.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The task has been successfully deleted.'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Without a task-delete permission, only a manager of one of the task teams may delete it.'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'Other records (a linked issue, a key result) still point at the task (`TASK_STILL_REFERENCED`); it stays.'
	})
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.taskService.deleteTask(id);
	}

	/**
	 * DELETE a task to the trash (soft delete), under the grants a delete takes: the inherited route ran under the
	 * class-level `ALL_ORG_EDIT` alone, so those who may delete a task could not trash it. Without `ALL_ORG_EDIT` or
	 * `ORG_TASK_DELETE`, only a manager of one of the task's teams may (the service checks it).
	 *
	 * @param id The task.
	 */
	@ApiOperation({ summary: 'Move a task to the trash (soft delete).' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The task is in the trash.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only a manager of one of the task teams may.' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE, PermissionsEnum.ORG_TASK_EDIT)
	@Delete('/:id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID): Promise<Task> {
		return this.taskService.softRemove(id);
	}

	/**
	 * PUT a task back from the trash, under the same grants as moving it there.
	 *
	 * @param id The task.
	 */
	@ApiOperation({ summary: 'Restore a task from the trash.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The task is restored.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only a manager of one of the task teams may.' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE, PermissionsEnum.ORG_TASK_EDIT)
	@Put('/:id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID): Promise<Task> {
		return this.taskService.softRecover(id);
	}

	/**
	 * DELETE a task for good, only while it is in the trash: the trash pages' Delete forever. The delete statement
	 * itself requires the task to be in the trash, so a task someone restored after the trash was read stays (404),
	 * where `DELETE /tasks/:id` would delete the live task. Under the grants of the trash and restore routes, behind
	 * `GAUZY_TASK_TRASH_ENABLED` as the trash list is.
	 *
	 * @param id The task.
	 * @param query The organization whose trash holds the task.
	 */
	@ApiOperation({ summary: 'Delete a task for good, only while it is in the trash.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The task is deleted for good.' })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No task with that id is in the trash of the organization, or the trash is not enabled.'
	})
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Only a manager of one of the task teams may.' })
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'Other records (a linked issue, a key result) still point at the task; it stays in the trash.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_DELETE, PermissionsEnum.ORG_TASK_EDIT)
	@UseGuards(TaskTrashEnabledGuard)
	@Delete('/:id/trashed')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async deleteTrashed(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: TenantOrganizationBaseDTO
	): Promise<DeleteResult> {
		return this.taskService.deleteTrashedTask(id, query?.organizationId ?? query?.organization?.id);
	}

	/**
	 * PUT one member on a task, changing nothing else
	 *
	 * The full update writes the whole member list, so a client that adds one member sends back a list it read
	 * earlier and undoes an assignment made since.
	 *
	 * @param id The ID of the task.
	 * @param employeeId The ID of the employee to assign.
	 * @param query The caller's organization, which must be the task's.
	 */
	@ApiOperation({ summary: 'Assign one member to a task.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The employee is a member of the task.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "The employee is not one of the task's organization." })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description:
			'Only the employee themselves, an organization admin or a manager of the task team may assign them.'
	})
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put('/:id/members/:employeeId')
	@UseValidationPipe({ whitelist: true })
	async addMember(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('employeeId', UUIDValidationPipe) employeeId: ID,
		@Query() query: TaskMemberDTO
	): Promise<void> {
		return this.taskService.addMember(id, employeeId, query.organizationId);
	}

	/**
	 * DELETE one member from a task, changing nothing else
	 *
	 * The full update writes the whole member list, so a client that drops one member sends back a list it read
	 * earlier and undoes an assignment made since.
	 *
	 * @param id The ID of the task.
	 * @param employeeId The ID of the employee to take off the task.
	 * @param query The caller's organization, which must be the task's.
	 */
	@ApiOperation({ summary: 'Remove one member from a task.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The employee is no longer a member of the task.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found.' })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description:
			'Only the employee themselves, an organization admin or a manager of the task team may remove them.'
	})
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Delete('/:id/members/:employeeId')
	@UseValidationPipe({ whitelist: true })
	async removeMember(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('employeeId', UUIDValidationPipe) employeeId: ID,
		@Query() query: TaskMemberDTO
	): Promise<void> {
		return this.taskService.removeMember(id, employeeId, query.organizationId);
	}

	/**
	 * DELETE employee from team tasks
	 *
	 * Unassign an employee from tasks associated with a specific organization team.
	 *
	 * @param employeeId The ID of the employee to be unassigned from tasks.
	 * @param organizationTeamId The ID of the organization team from which to unassign the employee.
	 * @returns A Promise that resolves with the result of the no assignment.
	 */
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Delete('/employee/:employeeId')
	@UseValidationPipe({ whitelist: true })
	async deleteEmployeeFromTasks(
		@Param('employeeId', UUIDValidationPipe) employeeId: ID,
		@Query('organizationTeamId', UUIDValidationPipe) organizationTeamId: ID
	): Promise<void> {
		return this.taskService.unassignEmployeeFromTeamTasks(employeeId, organizationTeamId);
	}
}
