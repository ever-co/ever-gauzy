import {
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { I18nLang } from 'nestjs-i18n';
import { PermissionsEnum, LanguagesEnum, IPagination, IEmployee, ID } from '@gauzy/contracts';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { BulkBodyLoadTransformPipe, ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import {
	EmployeeCreateCommand,
	EmployeeBulkCreateCommand,
	EmployeeUpdateCommand,
	WorkingEmployeeGetCommand,
	EmployeeGetCommand
} from './commands';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import {
	EmployeeBulkInputDTO,
	CreateEmployeeDTO,
	UpdateEmployeeDTO,
	UpdateProfileDTO,
	FindMembersInputDTO
} from './dto';

@ApiTags('Employee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
@Controller('/employee')
export class EmployeeController extends CrudController<Employee> {
	constructor(private readonly _employeeService: EmployeeService, private readonly _commandBus: CommandBus) {
		super(_employeeService);
	}

	/**
	 * Retrieve all working employees based on specified query data.
	 *
	 * This endpoint fetches all working employees using a command pattern. The query parameter 'data'
	 * is parsed using a custom `ParseJsonPipe`, allowing clients to provide structured input.
	 *
	 * @param data - The JSON-formatted query data, parsed by `ParseJsonPipe`.
	 * @returns A promise resolving to a paginated list of working employees.
	 */
	@ApiOperation({ summary: 'Find all working employees.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found working employees',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No working employees found'
	})
	@Permissions(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
	@Get('/working')
	async findAllWorkingEmployees(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEmployee>> {
		const { findInput } = data;
		return await this._commandBus.execute(new WorkingEmployeeGetCommand(findInput));
	}

	/**
	 * Retrieve the count of all working employees.
	 *
	 * This endpoint returns the total count of working employees, based on the given query data.
	 * The 'data' parameter is parsed with `ParseJsonPipe` to ensure correct structure.
	 *
	 * @param data - The JSON-formatted query data parsed by `ParseJsonPipe`.
	 * @returns A promise resolving to an object with the total count of working employees.
	 * @throws NotFoundException if no data is provided or if the count operation fails.
	 */
	@ApiOperation({ summary: 'Get the total count of all working employees.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found the total count of working employees'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Working employees count not found'
	})
	@Permissions(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
	@Get('/working/count')
	async findAllWorkingEmployeesCount(@Query('data', ParseJsonPipe) data: any): Promise<{ total: number }> {
		const { findInput } = data;
		const { organizationId, forRange } = findInput;
		return await this._employeeService.findWorkingEmployeesCount(organizationId, forRange);
	}

	/**
	 * CREATE bulk employees in the same tenant.
	 *
	 * This endpoint allows for the bulk creation of employees within the same tenant.
	 * It accepts an array of employee data and processes it in a single request.
	 *
	 * @param entity The DTO containing the list of employees to create.
	 * @param themeLanguage The theme language for additional context.
	 * @param languageCode The language code for localization.
	 * @param origin The origin of the request for reference.
	 * @returns A promise resolving to an array of the created employees.
	 */
	@ApiOperation({ summary: 'Create multiple employee records in bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues about what went wrong.'
	})
	@Post('/bulk')
	async createBulk(
		@Body(BulkBodyLoadTransformPipe, new ValidationPipe({ transform: true })) entity: EmployeeBulkInputDTO,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') origin: string
	): Promise<IEmployee[]> {
		// Execute a command to create multiple employees in bulk
		return await this._commandBus.execute(
			new EmployeeBulkCreateCommand(entity.list, themeLanguage || languageCode, origin)
		);
	}

	/**
	 * GET employee count in the same tenant.
	 *
	 * This endpoint retrieves the count of employees within a specific tenant.
	 * It takes query parameters to filter the employee count by certain criteria.
	 *
	 * @param options Query parameters to filter the employee count.
	 * @returns A promise resolving to the total count of employees in the tenant.
	 */
	@ApiOperation({ summary: 'Get employee count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the employee count.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid query parameters. Please check your input.'
	})
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'An error occurred while retrieving the employee count.'
	})
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	@Get('/count')
	@UseValidationPipe()
	async getCount(@Query() options: CountQueryDTO<Employee>): Promise<number> {
		return await this._employeeService.countBy(options);
	}

	/**
	 * GET employees by pagination in the same tenant.
	 *
	 * This endpoint retrieves employees by pagination within a specific tenant.
	 * It uses query parameters to manage pagination and filtering options.
	 *
	 * @param params Pagination and filtering parameters.
	 * @returns A promise resolving to a paginated list of employees.
	 */
	@ApiOperation({ summary: 'Get employees by pagination in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved paginated employees.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid query parameters. Please check your input.'
	})
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: 'An error occurred while retrieving paginated employees.'
	})
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Employee>): Promise<IPagination<IEmployee>> {
		return await this._employeeService.pagination(params);
	}

	/**
	 * GET members of the organization
	 *
	 * This endpoint retrieves a list of members of the organization based on the provided query parameters.
	 * It allows filtering by organization team ID, organization project ID, and other criteria.
	 *
	 * @param options - Query parameters for filtering members.
	 * @returns A promise resolving to a list of members.
	 */
	@ApiOperation({ summary: 'Get members of the organization' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Members of the organization'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No members found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid query parameters. Please check your input.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_MEMBERS_VIEW)
	@Get('/members')
	@UseValidationPipe()
	async getMembers(@Query() options: FindMembersInputDTO): Promise<IPagination<IEmployee>> {
		return await this._employeeService.findMembers(options);
	}

	/**
	 * GET all employees in the same tenant.
	 *
	 * This endpoint retrieves all employees within a specific tenant with pagination and filtering options.
	 * It applies additional constraints to ensure only active, non-archived employees are retrieved.
	 *
	 * @param options Pagination and filtering parameters.
	 * @returns A promise resolving to a paginated list of employees.
	 */
	@ApiOperation({ summary: 'Find all employees in the same tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully found employees in the tenant.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No employees found for the given criteria.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid query parameters. Please check your input.'
	})
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() options: PaginationParams<Employee>): Promise<IPagination<IEmployee>> {
		// Enforce that only active, non-archived users are retrieved
		const where = {
			...(options.where || {}),
			user: { isActive: true, isArchived: false }
		};

		return await this._employeeService.findAll({ ...options, where });
	}

	/**
	 * GET employee by ID within the same tenant.
	 *
	 * This endpoint retrieves an employee by their ID, allowing additional filtering based on permissions.
	 *
	 * @param id The unique identifier of the employee to find.
	 * @param params Additional query parameters to customize the search, like related entities.
	 * @returns A promise resolving to the employee record if found.
	 */
	@ApiOperation({ summary: 'Find employee by ID within the same tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Employee record found.',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Employee record not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. Check your query parameters.'
	})
	@Permissions()
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: OptionParams<Employee>
	): Promise<IEmployee> {
		const currentEmployeeId = RequestContext.currentEmployeeId();

		// Check permissions to determine the correct ID to retrieve
		const searchCriteria = {
			where: {
				...(RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
					? { id }
					: { id: currentEmployeeId })
			},
			...(params.relations ? { relations: params.relations } : {}),
			withDeleted: true
		};

		return await this._commandBus.execute(new EmployeeGetCommand(searchCriteria));
	}

	/**
	 * CREATE a new employee in the same tenant.
	 *
	 * This endpoint creates a new employee, handling necessary validations and internationalization.
	 *
	 * @param entity The details of the new employee to be created.
	 * @param origin The origin header, used to determine the request source.
	 * @param languageCode The language code for localization and internationalization.
	 * @returns A promise resolving to the newly created employee record.
	 */
	@ApiOperation({ summary: 'Create a new employee in the same tenant' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Employee record created successfully.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. Check the request body for potential issues.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ transform: true })
	async create(
		@Body() entity: CreateEmployeeDTO,
		@Headers('origin') origin: string,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IEmployee> {
		return await this._commandBus.execute(new EmployeeCreateCommand(entity, languageCode, origin));
	}

	/**
	 * UPDATE an existing employee by ID in the same tenant.
	 *
	 * This endpoint updates an existing employee record based on the provided ID and update data.
	 *
	 * @param id The unique identifier of the employee to update.
	 * @param entity The data to update for the employee.
	 * @returns A promise resolving to the updated employee record.
	 */
	@ApiOperation({ summary: 'Update an existing employee by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The employee record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. Check the request body for errors.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateEmployeeDTO): Promise<IEmployee> {
		return await this._commandBus.execute(new EmployeeUpdateCommand(id, entity));
	}

	/**
	 * Update employee's own profile by themselves
	 *
	 * This endpoint allows an employee to update their own profile.
	 *
	 * @param id The unique identifier of the employee.
	 * @param entity The data to update for the employee's profile.
	 * @returns A promise resolving to the updated employee record.
	 */
	@ApiOperation({ summary: 'Update Employee Own Profile' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Profile has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. Check the response body for more details.'
	})
	@Permissions(PermissionsEnum.PROFILE_EDIT)
	@Put('/:id/profile')
	@UseValidationPipe({ whitelist: true })
	async updateProfile(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateProfileDTO): Promise<IEmployee> {
		return await this._commandBus.execute(new EmployeeUpdateCommand(id, entity));
	}

	/**
	 * Soft delete employee from organization
	 *
	 * @param employeeId
	 * @returns
	 */
	@ApiOperation({ summary: 'Soft delete record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:id')
	@UseValidationPipe({ whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: TenantOrganizationBaseDTO
	): Promise<DeleteResult> {
		return await this._employeeService.delete(id, { where: { ...options } });
	}

	/**
	 * Soft deletes an employee from the organization by ID.
	 *
	 * This endpoint allows soft-deletion of an employee record by providing its UUID.
	 *
	 * @param employeeId - The UUID of the employee to be soft-deleted.
	 * @param params - Parameters required for tenant/organization identification.
	 * @returns A promise resolving to the soft-deleted employee entity.
	 */
	@ApiOperation({ summary: 'Soft delete employee record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully soft-deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Employee record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:id/soft')
	@UseValidationPipe({ whitelist: true })
	async softRemove(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: TenantOrganizationBaseDTO
	): Promise<Employee> {
		// Soft remove the employee by ID
		return await this._employeeService.softRemovedById(id, params);
	}

	/**
	 * Restores a soft-deleted employee by ID.
	 *
	 * This endpoint allows the restoration of a soft-deleted employee record by providing its UUID.
	 *
	 * @param employeeId - The UUID of the employee to be restored.
	 * @param params - Parameters for tenant/organization identification.
	 * @returns A promise resolving to the restored employee entity.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted employee record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully restored'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Employee record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id/recover')
	@UseValidationPipe({ whitelist: true })
	async softRecover(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() params: TenantOrganizationBaseDTO
	): Promise<Employee> {
		// Attempt to recover the soft-removed employee
		return await this._employeeService.softRecoverById(id, params);
	}
}
