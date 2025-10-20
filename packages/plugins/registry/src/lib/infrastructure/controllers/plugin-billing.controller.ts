import {
	Controller,
	Get,
	Post,
	Put,
	Param,
	Body,
	Query,
	HttpStatus,
	HttpCode,
	UseGuards,
	ValidationPipe,
	ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantPermissionGuard, PermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { PluginBillingService } from '../../domain/services/plugin-billing.service';
import { IPluginBilling, IPluginBillingSummary, IPluginBillingFindInput } from '../../shared/models';
import { CreatePluginBillingDTO } from '../../shared/dto/create-plugin-billing.dto';
import { UpdatePluginBillingDTO } from '../../shared/dto/update-plugin-billing.dto';
import { IPagination } from '@gauzy/contracts';
import { UpdateResult } from 'typeorm';

@ApiTags('Plugin Billing')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('billings')
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
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin billing records retrieved successfully'
	})
	@Get()
	async findAll(
		@Query(new ValidationPipe({ whitelist: true, transform: true }))
		options?: IPluginBillingFindInput
	): Promise<IPagination<IPluginBilling>> {
		if (options && Object.keys(options).length > 0) {
			const result = await this.pluginBillingService.findBillings(options);
			// Convert array to IPagination format
			return {
				items: result,
				total: result.length
			};
		}
		return this.pluginBillingService.findAll();
	}

	/**
	 * Get overdue billing records
	 */
	@ApiOperation({ summary: 'Get overdue billing records' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Overdue billing records retrieved successfully'
	})
	@Get('overdue')
	async getOverdue(): Promise<IPluginBilling[]> {
		return this.pluginBillingService.getOverdueBillings();
	}

	/**
	 * Get billing summary for a subscription
	 */
	@ApiOperation({ summary: 'Get billing summary for subscription' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Billing summary retrieved successfully'
	})
	@Get('summary/:subscriptionId')
	async getBillingSummary(
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
	 * Mark billing record as paid
	 */
	@ApiOperation({ summary: 'Mark billing record as paid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Billing record marked as paid'
	})
	@Put(':id/mark-paid')
	async markAsPaid(
		@Param('id', UUIDValidationPipe) id: string,
		@Body('paymentReference') paymentReference?: string
	): Promise<IPluginBilling> {
		await this.pluginBillingService.markAsPaid(id, paymentReference);
		return await this.pluginBillingService.findOneByIdString(id);
	}

	/**
	 * Mark billing record as failed
	 */
	@ApiOperation({ summary: 'Mark billing record as failed' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Billing record marked as failed'
	})
	@Put(':id/mark-failed')
	async markAsFailed(
		@Param('id', UUIDValidationPipe) id: string,
		@Body('reason') reason?: string
	): Promise<IPluginBilling | UpdateResult> {
		return this.pluginBillingService.markAsFailed(id, reason);
	}
}
