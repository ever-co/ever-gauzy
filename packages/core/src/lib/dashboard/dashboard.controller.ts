import { CommandBus } from '@nestjs/cqrs';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import { CrudController, PaginationParams } from '../core/crud';
import { Dashboard } from './dashboard.entity';
import { DashboardService } from './dashboard.service';
import { DashboardCreateCommand, DashboardUpdateCommand } from './commands';
import { CreateDashboardDTO, UpdateDashboardDTO } from './dto';

@ApiTags('Dashboard')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.DASHBOARD_READ)
@Controller('dashboard')
export class DashboardController extends CrudController<Dashboard> {
	constructor(private readonly dashboardService: DashboardService, private readonly commandBus: CommandBus) {
		super(dashboardService);
	}

	@ApiOperation({ summary: 'Get dashboards.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found dashboards',
		type: Dashboard
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	@Get()
	async findAll(@Query() params: PaginationParams<Dashboard>): Promise<IPagination<Dashboard>> {
		return this.dashboardService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found dashboard',
		type: Dashboard
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	@Get(':id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: PaginationParams<Dashboard>
	): Promise<Dashboard> {
		return this.dashboardService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create dashboard.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_CREATE)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateDashboardDTO): Promise<Dashboard> {
		return await this.commandBus.execute(new DashboardCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update dashboard.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_UPDATE)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateDashboardDTO): Promise<Dashboard> {
		return await this.commandBus.execute(new DashboardUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete dashboard.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.dashboardService.delete(id);
	}
}
