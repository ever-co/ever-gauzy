import { CommandBus } from '@nestjs/cqrs';
import { Controller, Query, Get, HttpStatus, Param, Post, Body, HttpCode, Put, Delete, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { UseValidationPipe, UUIDValidationPipe, AbstractValidationPipe } from '../../shared/pipes';
import { CrudController, BaseQueryDTO } from '../../core/crud';
import { DashboardWidget } from './dashboard-widget.entity';
import { DashboardWidgetCreateCommand, DashboardWidgetUpdateCommand } from './commands';
import { DashboardWidgetService } from './dashboard-widget.service';
import { CreateDashboardWidgetDTO, UpdateDashboardWidgetDTO } from './dto';
import { TenantOrganizationBaseDTO } from '../../core/dto';

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
	async findAll(@Query() params: BaseQueryDTO<DashboardWidget>): Promise<IPagination<DashboardWidget>> {
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
		@Query() params: BaseQueryDTO<DashboardWidget>
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

	/**
	 * Withdraws a dashboard widget without removing the row — the `DELETE /:id/soft` route the CRUD base maps.
	 *
	 * Restated only to state its permission. Left inherited, the route carried none, and `PermissionGuard` —
	 * handler first, then class — authorised it on this class's read grant (`DASHBOARD_READ`), so a role that
	 * may only look could withdraw a row. The soft-delete/recover pair requires the controller's own edit grant,
	 * the one `update` states (owner decision 5, 2026-10-13); the status code, the path, the validation and the
	 * service call are the inherited route's own, so the change is who may call it and nothing else. The GraphQL
	 * field that mirrors it states the same grant.
	 *
	 * @param id The row to withdraw.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The withdrawn row.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<DashboardWidget> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a withdrawn row — the `PUT /:id/recover` route the CRUD base maps.
	 *
	 * Restated for the reason the withdrawal above is: restoring undoes a removal, so it requires the same edit
	 * grant (owner decision 5) rather than the class's read grant (`DASHBOARD_READ`) the inherited route stood on.
	 *
	 * @param id The row to restore.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The restored row.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<DashboardWidget> {
		return await super.softRecover(id, ...options);
	}
}
