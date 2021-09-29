import {
	IEmployeeCreateInput,
	PermissionsEnum,
	LanguagesEnum,
	UpdateEmployeeJobsStatistics,
	IPagination,
	IEmployee
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	Req,
	UseInterceptors,
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { FindManyOptions } from 'typeorm';
import { Request } from 'express';
import {
	EmployeeCreateCommand,
	EmployeeBulkCreateCommand,
	GetEmployeeJobStatisticsCommand,
	UpdateEmployeeJobSearchStatusCommand,
	EmployeeUpdateCommand,
	WorkingEmployeeGetCommand
} from './commands';
import { CrudController, ITryRequest, PaginationParams } from './../core/crud';
import { RequestContext } from '../core/context';
import { TransformInterceptor } from './../core/interceptors';
import { Permissions, Public } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';

@ApiTags('Employee')
@UseInterceptors(TransformInterceptor)
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
	@Get('/working')
	@UseGuards(TenantPermissionGuard)
	async findAllWorkingEmployees(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEmployee>> {
		const { findInput } = data;
		return await this.commandBus.execute(
			new WorkingEmployeeGetCommand(findInput)
		);
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
	@Get('/working/count')
	@UseGuards(TenantPermissionGuard)
	async findAllWorkingEmployeesCount(
		@Query('data', ParseJsonPipe) data: any
	): Promise<{ total: number }> {
		const { findInput } = data;
		const { organizationId, forMonth = new Date(), withUser } = findInput;
		return this.employeeService.findWorkingEmployeesCount(
			organizationId,
			new Date(forMonth),
			withUser
		);
	}

	/**
	 * GET employee jobs statistics
	 * 
	 * @param request 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Get Employee Jobs Statistics' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Found employee'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Get('/job-statistics')
	async getEmployeeJobsStatistics(@Query() request: FindManyOptions) {
		return this.commandBus.execute(
			new GetEmployeeJobStatisticsCommand(request)
		);
	}

	/**
	 * GET all public information employees in the same tenant.
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all public information employees in the same tenant.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employees in the tenant',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/public')
	@Public()
	/**
	 * TODO: This is a public service, the response should only contain
	 * those fields (columns) of an employee that can be shown to the public
	 */
	async findAllEmployeesPublicData(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEmployee>> {
		const { relations = [], findInput = null } = data;
		return this.employeeService.findAll({ 
			where: findInput, 
			relations 
		});
	}

	/**
	 * GET all public information employee in the same tenant.
	 * 
	 * @param id 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all public information employee in the same tenant.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee in the tenant',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/public/:id')
	@Public()
	async findEmployeePublic(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IEmployee> {
		const { relations = [] } = data;
		return this.employeeService.findOne(id, {
			relations
		});
	}

	/**
	 * GET employee by user id in the same tenant
	 * 
	 * @param userId 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find employee by user id in the same tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee in the same tenant',
		type: Employee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/user/:userId')
	@UseGuards(TenantPermissionGuard)
	async findByUserId(
		@Param('userId', UUIDValidationPipe) userId: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<ITryRequest> {
		const { relations = [] } = data;
		return this.employeeService.findOneOrFailByOptions({
			where: {
				userId
			},
			relations
		});
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Post('/bulk')
	async createBulkEmployee(
		@Body() entity: IEmployeeCreateInput[],
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IEmployee[]> {
		return await this.commandBus.execute(
			new EmployeeBulkCreateCommand(entity, languageCode)
		);
	}

	
	/**
	 * GET employee count in the same tenant.
	 * 
	 * @param filter 
	 * @returns 
	 */
	@Get('count')
	@UsePipes(new ValidationPipe({ transform: true }))
	async getCount(
		@Query() filter: PaginationParams<IEmployee>
	): Promise<number> {
		return this.employeeService.count({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			...filter
		});
	}

	/**
	 * GET employees by pagination in the same tenant.
	 * 
	 * @param filter 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IEmployee>
	): Promise<IPagination<IEmployee>> {
		return this.employeeService.paginate(filter);
	}

	/**
	 * GET all employees in the same tenant.
	 * 
	 * @param data 
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
	@Get()
	@UseGuards(TenantPermissionGuard)
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEmployee>> {
		const { relations = [], findInput } = data;
		return this.employeeService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET employee by id in the same tenant.
	 * 
	 * @param id 
	 * @param data 
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<Employee> {
		const { relations = [], useTenant } = data;
		if (useTenant) {
			return this.employeeService.findOne(id, {
				relations
			});
		} else {
			return this.employeeService.findWithoutTenant(id, {
				relations
			});
		}
	}
	
	/**
	 * CREATE employee in the same tenant
	 * 
	 * @param entity 
	 * @param request 
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Post()
	async create(
		@Body() entity: IEmployeeCreateInput,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IEmployee> {
		entity.originalUrl = request.get('Origin');
		return await this.commandBus.execute(
			new EmployeeCreateCommand(entity, languageCode)
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: Employee
	): Promise<IEmployee> {
		return await this.commandBus.execute(
			new EmployeeUpdateCommand({
				id,
				...entity
			})
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('/:id/job-search-status')
	async updateJobSearchStatus(
		@Param('id', UUIDValidationPipe) employeeId: string,
		@Body() entity: UpdateEmployeeJobsStatistics
	): Promise<IEmployee[]> {
		return await this.commandBus.execute(
			new UpdateEmployeeJobSearchStatusCommand(employeeId, entity)
		);
	}
}