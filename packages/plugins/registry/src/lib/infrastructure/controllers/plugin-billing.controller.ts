import { IPagination, PermissionsEnum, PluginBillingStatus } from '@gauzy/contracts';
import {
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Patch,
	Post,
	Put,
	Query,
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginBillingService } from '../../domain/services/plugin-billing.service';
import { PluginService } from '../../domain/services/plugin.service';
import { CreatePluginBillingDTO } from '../../shared/dto/create-plugin-billing.dto';
import { UpdatePluginBillingDTO } from '../../shared/dto/update-plugin-billing.dto';
import { IPluginBilling, IPluginBillingFindInput, IPluginBillingSummary } from '../../shared/models';
import { resolveBillingWriteAccess } from './plugin-billing-write-access';

/**
 * A plugin subscription's billing records.
 *
 * The routes stated no permission, so `PermissionGuard` let every member of the tenant through: any of them could
 * read the tenant's billing, create billing records, rewrite their amounts and mark bills paid or failed. Reading
 * now needs `PLUGIN_CONFIGURE`, as the subscription's own edits do.
 *
 * Writing (create, `PUT`, `PATCH`) is for the plugin's publisher and the installation's operator only, on a bill of
 * any tenant, written in the bill's own tenant (`plugin-billing-write-access.ts`); the payment handling writes bills
 * through the service, not these routes. The subscriber's admins read and pay their bills but may not mark one paid.
 * The write routes state `PLUGIN_CONFIGURE`, the grant a publisher manages their plugin with.
 */
@ApiTags('Plugin Billing')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/:pluginId/subscriptions/:subscriptionId/billings')
export class PluginBillingController {
	constructor(
		private readonly pluginBillingService: PluginBillingService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * The bill a write names, once {@link resolveBillingWriteAccess} let the caller through: it must belong to the
	 * subscription the route names, or it is not found.
	 */
	private async billOfRoute(pluginId: string, subscriptionId: string, id: string): Promise<IPluginBilling> {
		await resolveBillingWriteAccess(this.pluginBillingService, this.pluginService, pluginId, subscriptionId);
		const billing = await this.pluginBillingService.findOneInAnyTenant(id);
		if (!billing || billing.subscriptionId !== subscriptionId) {
			throw new NotFoundException(`Billing record with ID ${id} not found`);
		}
		return billing;
	}

	/**
	 * Create a new plugin billing record
	 */
	@ApiOperation({ summary: 'Create plugin billing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin billing record created successfully',
		type: 'IPluginBilling'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'subscriptionId', description: 'Subscription ID', type: String, format: 'uuid' })
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(
		@Param('pluginId', UUIDValidationPipe) pluginId: string,
		@Param('subscriptionId', UUIDValidationPipe) subscriptionId: string,
		@Body() input: CreatePluginBillingDTO
	): Promise<IPluginBilling> {
		const subscription = await resolveBillingWriteAccess(
			this.pluginBillingService,
			this.pluginService,
			pluginId,
			subscriptionId
		);
		return this.pluginBillingService.createForSubscription(input, subscription);
	}

	/**
	 * Get all plugin billing records
	 */
	@ApiOperation({ summary: 'Get all plugin billing records' })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'subscriptionId', description: 'Subscription ID', type: String, format: 'uuid' })
	@ApiQuery({
		name: 'status',
		required: false,
		description: 'Filter by billing status (overdue, paid, pending, failed)'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin billing records retrieved successfully'
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Get()
	async findAll(
		@Param('pluginId', UUIDValidationPipe) pluginId: string,
		@Param('subscriptionId', UUIDValidationPipe) subscriptionId: string,
		@Query('status') status?: 'overdue' | 'paid' | 'pending' | 'failed',
		@Query(new ValidationPipe({ whitelist: true, transform: true }))
		options?: IPluginBillingFindInput
	): Promise<IPagination<IPluginBilling>> {
		// Build search criteria
		const searchOptions: IPluginBillingFindInput = {
			...options,
			subscriptionId
		};

		// Handle status filter
		if (status === 'overdue') {
			const overdueResults = await this.pluginBillingService.getOverdueBillings();
			return {
				items: overdueResults.filter((bill) => bill.subscriptionId === subscriptionId),
				total: overdueResults.filter((bill) => bill.subscriptionId === subscriptionId).length
			};
		}

		if (status) {
			// Map string status to enum
			const statusMap = {
				overdue: PluginBillingStatus.OVERDUE,
				paid: PluginBillingStatus.PAID,
				pending: PluginBillingStatus.PENDING,
				failed: PluginBillingStatus.FAILED
			};
			searchOptions.status = statusMap[status];
		}

		const hasFilters = Object.keys(searchOptions).length > 0;
		if (hasFilters) {
			const result = await this.pluginBillingService.findBillings(searchOptions);
			return {
				items: result,
				total: result.length
			};
		}
		return this.pluginBillingService.findAll();
	}

	/**
	 * Get billing summary for a subscription
	 */
	@ApiOperation({ summary: 'Get billing summary for subscription' })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'subscriptionId', description: 'Subscription ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Billing summary retrieved successfully'
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Get('summary')
	async getBillingSummary(
		@Param('pluginId', UUIDValidationPipe) pluginId: string,
		@Param('subscriptionId', UUIDValidationPipe) subscriptionId: string
	): Promise<IPluginBillingSummary> {
		return this.pluginBillingService.getBillingSummary(subscriptionId);
	}

	/**
	 * Get plugin billing record by ID
	 */
	@ApiOperation({ summary: 'Get plugin billing record by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin billing record retrieved successfully'
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Get(':id')
	async findOne(@Param('id', UUIDValidationPipe) id: string): Promise<IPluginBilling> {
		return this.pluginBillingService.findOneByIdString(id);
	}

	/**
	 * Update plugin billing record
	 */
	@ApiOperation({ summary: 'Update plugin billing record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin billing record updated successfully'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'subscriptionId', description: 'Subscription ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Billing record ID', type: String, format: 'uuid' })
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('pluginId', UUIDValidationPipe) pluginId: string,
		@Param('subscriptionId', UUIDValidationPipe) subscriptionId: string,
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: UpdatePluginBillingDTO
	): Promise<IPluginBilling> {
		await this.billOfRoute(pluginId, subscriptionId, id);
		await this.pluginBillingService.updateInAnyTenant(id, input);
		return await this.pluginBillingService.findOneInAnyTenant(id);
	}

	/**
	 * Update billing record status
	 */
	@ApiOperation({ summary: 'Update billing record status' })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'subscriptionId', description: 'Subscription ID', type: String, format: 'uuid' })
	@ApiParam({ name: 'id', description: 'Billing record ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Billing record status updated successfully'
	})
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Patch(':id')
	@UseValidationPipe({ whitelist: true })
	async updateStatus(
		@Param('pluginId', UUIDValidationPipe) pluginId: string,
		@Param('subscriptionId', UUIDValidationPipe) subscriptionId: string,
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: { status: 'paid' | 'failed'; paymentReference?: string; reason?: string }
	): Promise<IPluginBilling> {
		const billing = await this.billOfRoute(pluginId, subscriptionId, id);
		if (input.status === 'paid') {
			await this.pluginBillingService.markAsPaidInAnyTenant(billing, input.paymentReference);
		} else if (input.status === 'failed') {
			await this.pluginBillingService.markAsFailedInAnyTenant(billing, input.reason);
		} else {
			// General status update
			await this.pluginBillingService.updateInAnyTenant(id, { status: input.status as any });
		}
		return await this.pluginBillingService.findOneInAnyTenant(id);
	}
}
