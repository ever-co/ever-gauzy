import {
	IEditEntityByMemberInput,
	IOrganizationProject,
	IPagination,
	PermissionsEnum,
	TaskListTypeEnum
} from '@gauzy/contracts';
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { OrganizationProjectEditByEmployeeCommand } from './commands';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectService } from './organization-project.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationProject')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationProjectController extends CrudController<OrganizationProject> {
	constructor(
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly commandBus: CommandBus
	) {
		super(organizationProjectService);
	}

	/**
	 * GET organization project by employee
	 * 
	 * @param id 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all organization projects by Employee.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee/:id')
	async findByEmployee(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<IPagination<IOrganizationProject>> {
		const { findInput = null } = data;
		return this.organizationProjectService.findByEmployee(id, findInput);
	}

	/**
	 * UPDATE organization project by employee
	 * 
	 * @param body 
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('employee')
	async updateByEmployee(
		@Body() body: IEditEntityByMemberInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationProjectEditByEmployeeCommand(body)
		);
	}

	/**
	 * UPDATE organization project task view mode
	 * 
	 * @param id 
	 * @param body 
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
	// @UseGuards(PermissionGuard)
	// @Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('/task-view/:id')
	async updateTaskViewMode(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { taskViewMode: TaskListTypeEnum }
	): Promise<any> {
		return this.organizationProjectService.updateTaskViewMode(
			id,
			body.taskViewMode
		);
	}

	/**
	 * GET organization project count
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find organization projects count.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found count',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('count')
	async getCount(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { relations, findInput } = data;
		return this.organizationProjectService.count({
			where: findInput,
			relations
		});
	}

	/**
	 * GET all organization project
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all organization projects.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any,
	): Promise<IPagination<IOrganizationProject>> {
		const { relations, findInput } = data;
		return this.organizationProjectService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE organization project by id
	 * 
	 * @param id 
	 * @param body 
	 * @returns 
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: OrganizationProject
	): Promise<IOrganizationProject> {
		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.organizationProjectService.create({
				id,
				...body
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
