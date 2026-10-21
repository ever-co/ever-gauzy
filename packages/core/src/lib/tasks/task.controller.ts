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
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { PermissionsEnum, ITask, IPagination, ID, ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
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
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskCreateCommand, TaskUpdateCommand } from './commands';
import {
	CreateTaskDTO,
	GetTaskByIdDTO,
	TaskDateFilterInputDTO,
	TaskByNumberParamsDTO,
	TaskByNumberQueryDTO,
	TaskMaxNumberQueryDTO,
	TaskQueryDTO,
	UpdateTaskDTO,
	UpdateTaskStatusDTO
} from './dto';

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
		// A partial update, as the service takes it: what the input leaves out stays as stored.
		return this.commandBus.execute(new TaskUpdateCommand(id, input as ITaskUpdateInput));
	}

	/**
	 * DELETE task by ID
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
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.taskService.deleteTask(id);
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
