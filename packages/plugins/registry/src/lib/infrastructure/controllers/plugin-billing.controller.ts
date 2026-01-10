import { IPagination, PluginBillingStatus } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
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
import { CreatePluginBillingDTO } from '../../shared/dto/create-plugin-billing.dto';
import { UpdatePluginBillingDTO } from '../../shared/dto/update-plugin-billing.dto';
import { IPluginBilling, IPluginBillingFindInput, IPluginBillingSummary } from '../../shared/models';

@ApiTags('Plugin Billing')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/:pluginId/subscriptions/:subscriptionId/billings')
export class PluginBillingController {
	constructor(private readonly pluginBillingService: PluginBillingService) {}

	/**
	 * Create a new plugin billing record
	 */
	@ApiOperation({ summary: 'Create plugin billing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin billing record created successfully',
		type: 'IPluginBilling'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() input: CreatePluginBillingDTO): Promise<IPluginBilling> {
		return this.pluginBillingService.create(input);
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
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: UpdatePluginBillingDTO
	): Promise<IPluginBilling> {
		await this.pluginBillingService.update(id, input);
		return await this.pluginBillingService.findOneByIdString(id);
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
	@Patch(':id')
	@UseValidationPipe({ whitelist: true })
	async updateStatus(
		@Param('pluginId', UUIDValidationPipe) pluginId: string,
		@Param('subscriptionId', UUIDValidationPipe) subscriptionId: string,
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: { status: 'paid' | 'failed'; paymentReference?: string; reason?: string }
	): Promise<IPluginBilling> {
		if (input.status === 'paid') {
			await this.pluginBillingService.markAsPaid(id, input.paymentReference);
		} else if (input.status === 'failed') {
			await this.pluginBillingService.markAsFailed(id, input.reason);
		} else {
			// General status update
			await this.pluginBillingService.update(id, { status: input.status as any });
		}
		return await this.pluginBillingService.findOneByIdString(id);
	}
}
