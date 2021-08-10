import {
	IEmployeeCreateInput,
	PermissionsEnum,
	LanguagesEnum,
	UpdateEmployeeJobsStatistics,
	IPagination
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
	Req
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
	EmployeeCreateCommand,
	EmployeeBulkCreateCommand,
	GetEmployeeJobStatisticsCommand,
	UpdateEmployeeJobSearchStatusCommand
} from './commands';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { getUserDummyImage } from '../core';
import { CrudController } from './../core/crud';
import { Permissions, Public } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { I18nLang } from 'nestjs-i18n';
import { ITryRequest } from '../core/crud/try-request';
import { Request } from 'express';
import { RequestContext } from '../core/context';
import { FindManyOptions } from 'typeorm';

@ApiTags('Employee')
@Controller()
export class EmployeeController extends CrudController<Employee> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly commandBus: CommandBus
	) {
		super(employeeService);
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Get('/job-statistics')
	async getEmployeeJobsStatistics(@Query() request: FindManyOptions) {
		return this.commandBus.execute(
			new GetEmployeeJobStatisticsCommand(request)
		);
	}

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
	@UseGuards(TenantPermissionGuard)
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: Employee
	): Promise<any> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return await this.employeeService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}

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
	async findAllEmployees(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Employee>> {
		const { relations, findInput } = data;
		return this.employeeService.findAll({
			where: findInput,
			relations
		});
	}

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
	@Get('public')
	@Public()
	/**
	 * TODO: This is a public service, the response should only contain
	 * those fields (columns) of an employee that can be shown to the public
	 */
	async findAllEmployeesPublicData(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Employee>> {
		const { relations, findInput } = data;
		return this.employeeService.findAll({ 
			where: findInput, 
			relations 
		});
	}

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
	@Get('public/:id')
	@Public()
	async findEmployeePublicData(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<Employee> {
		const { relations } = data;
		return this.employeeService.findOne(id, {
			relations
		});
	}

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
	): Promise<IPagination<Employee>> {
		const { findInput } = data;
		const { organizationId, forMonth = new Date(), withUser } = findInput;
		const tenantId = RequestContext.currentTenantId();

		return this.employeeService.findWorkingEmployees(
			organizationId,
			tenantId,
			new Date(forMonth),
			withUser
		);
	}

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
		const tenantId = RequestContext.currentTenantId();

		return this.employeeService.findWorkingEmployeesCount(
			organizationId,
			tenantId,
			new Date(forMonth),
			withUser
		);
	}

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
		const tenantId = RequestContext.currentTenantId();
		return this.employeeService.findOneOrFail({
			where: {
				userId,
				tenantId
			},
			relations
		});
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Post('/create')
	async create(
		@Body() entity: IEmployeeCreateInput,
		@Req() request: Request,
		@I18nLang() languageCode: LanguagesEnum,
		...options: any[]
	): Promise<Employee> {
		if (!entity.user.imageUrl) {
			entity.user.imageUrl = getUserDummyImage(entity.user);
		}
		entity.originalUrl = request.get('Origin');
		return this.commandBus.execute(
			new EmployeeCreateCommand(entity, languageCode)
		);
	}

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
	@Post('/createBulk')
	async createBulk(
		@Body() input: IEmployeeCreateInput[],
		@I18nLang() languageCode: LanguagesEnum,
		...options: any[]
	): Promise<Employee[]> {
		/**
		 * Use a dummy image avatar if no image is uploaded for any of the employees in the list
		 */

		input
			.filter((entity) => !entity.user.imageUrl)
			.forEach(
				(entity) =>
					(entity.user.imageUrl = getUserDummyImage(entity.user))
			);

		return this.commandBus.execute(
			new EmployeeBulkCreateCommand(input, languageCode)
		);
	}

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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('/:id/job-search-status')
	async updateJobSearchStatus(
		@Param('id', UUIDValidationPipe) employeeId: string,
		@Body() request: UpdateEmployeeJobsStatistics
	): Promise<Employee[]> {
		return this.commandBus.execute(
			new UpdateEmployeeJobSearchStatusCommand(employeeId, request)
		);
	}
}
