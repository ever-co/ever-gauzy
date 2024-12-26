import { CommandBus } from '@nestjs/cqrs';
import { Controller, Query, Get, HttpStatus, Param, Post, Body, HttpCode, Put, Delete } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { UseValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { CrudController, PaginationParams } from '../../core/crud';
import { DashboardWidget } from './dashboard-widget.entity';
import { DashboardWidgetCreateCommand, DashboardWidgetUpdateCommand } from './commands';
import { DashboardWidgetService } from './dashboard-widget.service';
import { CreateDashboardWidgetDTO, UpdateDashboardWidgetDTO } from './dto';

@ApiTags('Dashboard Widget')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.DASHBOARD_READ)
@Controller('dashboard-widget')
export class DashboardWidgetController extends CrudController<DashboardWidget> {
	constructor(
		private readonly dashboardWidgetService: DashboardWidgetService,
		private readonly commandBus: CommandBus
	) {
		super(dashboardWidgetService);
	}

	@ApiOperation({ summary: 'Get dashboard widgets.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found dashboard widgets',
		type: DashboardWidget
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	@Get()
	async findAll(@Query() params: PaginationParams<DashboardWidget>): Promise<IPagination<DashboardWidget>> {
		return this.dashboardWidgetService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found dashboard widget',
		type: DashboardWidget
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
		@Query() params: PaginationParams<DashboardWidget>
	): Promise<DashboardWidget> {
		return this.dashboardWidgetService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create dashboard widget.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateDashboardWidgetDTO): Promise<DashboardWidget> {
		return await this.commandBus.execute(new DashboardWidgetCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update dashboard widget.' })
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateDashboardWidgetDTO
	): Promise<DashboardWidget> {
		return await this.commandBus.execute(new DashboardWidgetUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete dashboard widget.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.dashboardWidgetService.delete(id);
	}
}
