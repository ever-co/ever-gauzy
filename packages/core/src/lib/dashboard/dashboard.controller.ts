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
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe, UUIDValidationPipe, AbstractValidationPipe } from '../shared/pipes';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { Dashboard } from './dashboard.entity';
import { DashboardService } from './dashboard.service';
import { DashboardCreateCommand, DashboardUpdateCommand } from './commands';
import { CreateDashboardDTO, UpdateDashboardDTO } from './dto';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('Dashboard')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.DASHBOARD_READ)
@Controller('/dashboard')
export class DashboardController extends CrudController<Dashboard> {
	constructor(private readonly dashboardService: DashboardService, private readonly commandBus: CommandBus) {
		super(dashboardService);
	}

	/**
	 * Retrieves a list of dashboards with pagination.
	 *
	 * @param params - The pagination and filter parameters.
	 * @returns A paginated list of dashboards.
	 */

	@ApiOperation({ summary: 'Retrieve a list of dashboards with pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved dashboards.',
		type: Dashboard
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No dashboards found.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	@Get('/')
	async findAll(@Query() params: BaseQueryDTO<Dashboard>): Promise<IPagination<Dashboard>> {
		return this.dashboardService.findAll(params);
	}

	/**
	 * Retrieves a dashboard by its unique identifier.
	 *
	 * @param id - The unique identifier of the dashboard.
	 * @param params - Additional query parameters for pagination or filtering.
	 * @returns The dashboard entity if found.
	 */
	@ApiOperation({ summary: 'Retrieve a dashboard by its ID.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Dashboard retrieved successfully.',
		type: Dashboard
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Dashboard not found.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	@Get('/:id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: BaseQueryDTO<Dashboard>
	): Promise<Dashboard> {
		return this.dashboardService.findOneByIdString(id, params);
	}

	/**
	 * Creates a new dashboard.
	 *
	 * @param entity - The data transfer object containing the details of the dashboard to be created.
	 * @returns The created dashboard entity.
	 */
	@ApiOperation({ summary: 'Create a new dashboard.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The dashboard has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, object invalid.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_CREATE)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateDashboardDTO): Promise<Dashboard> {
		return await this.commandBus.execute(new DashboardCreateCommand(entity));
	}

	/**
	 * Updates an existing dashboard.
	 *
	 * @param id - The UUID of the dashboard to be updated.
	 * @param entity - The data transfer object containing the updated details of the dashboard.
	 * @returns The updated dashboard entity.
	 */
	@ApiOperation({ summary: 'Update an existing dashboard.' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The dashboard has been successfully updated.',
		type: Dashboard
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Dashboard not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input; the response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_UPDATE)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateDashboardDTO): Promise<Dashboard> {
		return await this.commandBus.execute(new DashboardUpdateCommand(id, entity));
	}

	/**
	 * Deletes a dashboard by its ID.
	 *
	 * @param id - The UUID of the dashboard to delete.
	 * @returns The result of the delete operation.
	 */
	@ApiOperation({ summary: 'Delete a dashboard by ID.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The dashboard has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Dashboard not found.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_DELETE)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.dashboardService.delete(id);
	}

	/**
	 * Withdraws a dashboard without removing the row — the `DELETE /:id/soft` route the CRUD base maps.
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_UPDATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Dashboard> {
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_UPDATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Dashboard> {
		return await super.softRecover(id, ...options);
	}
}
