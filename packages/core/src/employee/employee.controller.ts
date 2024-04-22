import {
	BadRequestException,
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
import { I18nLang } from 'nestjs-i18n';
import { UpdateResult } from 'typeorm';
import { PermissionsEnum, LanguagesEnum, IPagination, IEmployee } from '@gauzy/contracts';
import {
	EmployeeCreateCommand,
	EmployeeBulkCreateCommand,
	GetEmployeeJobStatisticsCommand,
	UpdateEmployeeJobSearchStatusCommand,
	EmployeeUpdateCommand,
	WorkingEmployeeGetCommand,
	EmployeeGetCommand
} from './commands';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { BulkBodyLoadTransformPipe, ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import {
	EmployeeBulkInputDTO,
	CreateEmployeeDTO,
	UpdateEmployeeDTO,
	UpdateProfileDTO,
	EmployeeJobStatisticDTO
} from './dto';
import { RequestContext } from './../core/context';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('Employee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
@Controller()
export class EmployeeController extends CrudController<Employee> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus
	) {
		super(employeeService);
	}

	/**
	 * GET all working employees
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all working employees.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found working employees',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
	@Get('working')
	async findAllWorkingEmployees(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEmployee>> {
		const { findInput } = data;
		return await this.commandBus.execute(new WorkingEmployeeGetCommand(findInput));
	}

	/**
	 * GET all working employees count
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all working employees count.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found working employees count',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Count not found'
	})
	@Permissions(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
	@Get('working/count')
	async findAllWorkingEmployeesCount(@Query('data', ParseJsonPipe) data: any): Promise<{ total: number }> {
		const { findInput } = data;
		const { organizationId, forRange } = findInput;
		return await this.employeeService.findWorkingEmployeesCount(organizationId, forRange);
	}

	/**
	 * GET employee jobs statistics
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Get Employee Jobs Statistics' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Found employee'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW)
	@Get('job-statistics')
	@UseValidationPipe({ transform: true })
	async getEmployeeJobsStatistics(@Query() options: PaginationParams<Employee>): Promise<IPagination<IEmployee>> {
		return await this.commandBus.execute(new GetEmployeeJobStatisticsCommand(options));
	}

	/**
	 * CREATE bulk employees in the same tenant.
	 *
	 * @param entity
	 * @param languageCode
	 * @returns
	 */
	@ApiOperation({ summary: 'Create records in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('bulk')
	async createBulk(
		@Body(BulkBodyLoadTransformPipe, new ValidationPipe({ transform: true }))
		entity: EmployeeBulkInputDTO,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum,
		@Headers('origin') origin: string
	): Promise<IEmployee[]> {
		return await this.commandBus.execute(
			new EmployeeBulkCreateCommand(entity.list, themeLanguage || languageCode, origin)
		);
	}

	/**
	 * GET employee count in the same tenant.
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	@Get('count')
	@UseValidationPipe()
	async getCount(@Query() options: CountQueryDTO<Employee>): Promise<number> {
		return await this.employeeService.countBy(options);
	}

	/**
	 * GET employees by pagination in the same tenant.
	 *
	 * @param options
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Employee>): Promise<IPagination<IEmployee>> {
		return await this.employeeService.pagination(params);
	}

	/**
	 * GET all employees in the same tenant.
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all employees in the same tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employees in the tenant',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: PaginationParams<Employee>): Promise<IPagination<IEmployee>> {
		const where = {
			...(options.where || {}),
			user: {
				isActive: true,
				isArchived: false
			}
		};

		return this.employeeService.findAll({ ...options, where });
	}

	/**
	 * GET employee by id in the same tenant.
	 *
	 * @param id
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find employee by id in the same tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee in the same tenant',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions()
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: IEmployee['id'],
		@Query() params: OptionParams<Employee>
	): Promise<IEmployee> {
		try {
			return await this.commandBus.execute(
				new EmployeeGetCommand({
					where: {
						...(RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
							? { id }
							: { id: RequestContext.currentEmployeeId() })
					},
					...(params && params.relations
						? {
							relations: params.relations
						}
						: {}),
					withDeleted: true
				})
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * CREATE employee in the same tenant
	 *
	 * @param entity
	 * @param origin
	 * @param languageCode
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(
		@Body() entity: CreateEmployeeDTO,
		@Headers('origin') origin: string,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IEmployee> {
		return await this.commandBus.execute(new EmployeeCreateCommand(entity, languageCode, origin));
	}

	/**
	 * UPDATE employee by id in the same tenant
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IEmployee['id'],
		@Body() entity: UpdateEmployeeDTO
	): Promise<IEmployee> {
		try {
			return await this.commandBus.execute(
				new EmployeeUpdateCommand({
					id,
					...entity
				})
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Update employee own profile by themselves
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update Employee Own Profile' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Records have been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.PROFILE_EDIT)
	@Put(':id/profile')
	@UseValidationPipe({ whitelist: true })
	async updateProfile(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateProfileDTO
	): Promise<IEmployee> {
		try {
			return await this.commandBus.execute(
				new EmployeeUpdateCommand({
					id,
					...entity
				})
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * UPDATE employee job search status by employee id
	 *
	 * @param employeeId
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update Job Search Status' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put(':id/job-search-status')
	@UseValidationPipe({ whitelist: true })
	async updateJobSearchStatus(
		@Param('id', UUIDValidationPipe) employeeId: IEmployee['id'],
		@Body() entity: EmployeeJobStatisticDTO,
		@Headers() headers: Record<string, string>
	): Promise<IEmployee | UpdateResult> {
		return await this.commandBus.execute(new UpdateEmployeeJobSearchStatusCommand(employeeId, entity));
	}

	/**
	 * Restore soft deleted employee
	 *
	 * @param employeeId
	 * @returns
	 */
	@ApiOperation({ summary: 'Resort soft delete record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully restore'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/restore')
	@UseValidationPipe({ whitelist: true })
	async restoreSoftDelete(
		@Param('id', UUIDValidationPipe) employeeId: IEmployee['id'],
		@Body() entity: TenantOrganizationBaseDTO
	): Promise<UpdateResult> {
		return await this.employeeService.restoreSoftDelete(employeeId, entity);
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
	@Delete(':id')
	@UseValidationPipe({ whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) employeeId: string,
		@Query() params: TenantOrganizationBaseDTO
	): Promise<UpdateResult | Employee> {
		return await this.employeeService.softDeletedById(employeeId, params);
	}
}
