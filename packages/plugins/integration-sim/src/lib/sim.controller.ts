import {
	Controller,
	Get,
	Post,
	Delete,
	Body,
	Param,
	Query,
	HttpException,
	HttpStatus,
	HttpCode,
	UseGuards,
	UsePipes,
	ValidationPipe,
	Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { SimService } from './sim.service';
import { ConfigureSimIntegrationDto, ExecuteWorkflowDto, WorkflowExecutionQueryDto, EventMappingDto } from './dto';

@ApiTags('SIM Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard)
@Controller('/integration/sim')
export class SimController {
	private readonly logger = new Logger(SimController.name);

	constructor(private readonly simService: SimService) {}

	/**
	 * Configure SIM integration for the current tenant.
	 */
	@ApiOperation({ summary: 'Configure SIM integration with API key' })
	@ApiResponse({ status: 201, description: 'SIM integration configured successfully' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	@ApiQuery({ name: 'organizationId', required: false, description: 'Optional organization ID to scope the integration' })
	@Post('/setup')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async setupIntegration(
		@Body() body: ConfigureSimIntegrationDto,
		@Query('organizationId') organizationId?: string
	): Promise<{ integrationTenantId: string }> {
		try {
			return await this.simService.configureIntegration({
				apiKey: body.apiKey,
				organizationId
			});
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to configure SIM integration', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to configure SIM integration', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Get SIM integration settings (sanitized).
	 */
	@ApiOperation({ summary: 'Get SIM integration settings' })
	@ApiResponse({ status: 200, description: 'SIM integration settings retrieved' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/settings')
	async getSettings() {
		try {
			return await this.simService.getIntegrationSettings();
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get SIM settings', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get SIM integration settings', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Execute a SIM workflow.
	 */
	@ApiOperation({ summary: 'Execute a SIM workflow' })
	@ApiResponse({ status: 200, description: 'Workflow executed successfully' })
	@ApiResponse({ status: 404, description: 'Integration or workflow not found' })
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Post('/workflows/:workflowId/execute')
	@HttpCode(HttpStatus.OK)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async executeWorkflow(
		@Param('workflowId') workflowId: string,
		@Body() body: ExecuteWorkflowDto
	) {
		try {
			return await this.simService.executeWorkflow({
				workflowId,
				input: body.input,
				timeout: body.timeout,
				runAsync: body.runAsync,
				triggeredBy: 'manual'
			});
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to execute SIM workflow', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to execute SIM workflow', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Validate a workflow is deployed and ready.
	 */
	@ApiOperation({ summary: 'Validate a SIM workflow' })
	@ApiResponse({ status: 200, description: 'Workflow validation result' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/workflows/:workflowId/validate')
	async validateWorkflow(@Param('workflowId') workflowId: string) {
		try {
			const isValid = await this.simService.validateWorkflow(workflowId);
			return { workflowId, isDeployed: isValid };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to validate SIM workflow', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to validate SIM workflow', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Get async job status.
	 */
	@ApiOperation({ summary: 'Get async job status' })
	@ApiResponse({ status: 200, description: 'Job status retrieved' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/jobs/:taskId/status')
	async getJobStatus(@Param('taskId') taskId: string) {
		try {
			return await this.simService.getJobStatus(taskId);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get SIM job status', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get SIM job status', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Get execution history.
	 */
	@ApiOperation({ summary: 'Get workflow execution history' })
	@ApiResponse({ status: 200, description: 'Execution history retrieved' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/executions')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async getExecutionHistory(@Query() query: WorkflowExecutionQueryDto) {
		try {
			return await this.simService.getExecutionHistory(query);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get SIM execution history', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get SIM execution history', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Check if SIM integration is enabled.
	 */
	@ApiOperation({ summary: 'Check if SIM integration is enabled' })
	@ApiResponse({ status: 200, description: 'Returns integration status' })
	@Get('/status/:integrationTenantId')
	@ApiParam({ name: 'integrationTenantId', description: 'Integration Tenant UUID' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getIntegrationStatus(
		@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: string
	): Promise<{ enabled: boolean }> {
		try {
			const enabled = await this.simService.isIntegrationEnabled(integrationTenantId);
			return { enabled };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get SIM integration status', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get SIM integration status', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Get integration tenant information (with sensitive settings redacted).
	 */
	@ApiOperation({ summary: 'Get SIM integration tenant information' })
	@ApiResponse({ status: 200, description: 'Returns integration tenant information' })
	@Get('/integration-tenant/:integrationTenantId')
	@ApiParam({ name: 'integrationTenantId', description: 'Integration Tenant UUID' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async getIntegrationTenant(
		@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: string
	) {
		try {
			return await this.simService.getIntegrationTenant(integrationTenantId);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get SIM integration tenant', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get SIM integration tenant', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	// ─── Event-to-Workflow Mapping Endpoints ──────────────────────────────

	/**
	 * Get supported event types for workflow triggers.
	 */
	@ApiOperation({ summary: 'Get supported event types for SIM workflow triggers' })
	@ApiResponse({ status: 200, description: 'Returns list of supported event types' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/events/supported')
	getSupportedEvents() {
		return this.simService.getSupportedEvents();
	}

	/**
	 * Get all event-to-workflow mappings for the current tenant.
	 */
	@ApiOperation({ summary: 'Get all event-to-workflow mappings' })
	@ApiResponse({ status: 200, description: 'Returns list of event-to-workflow mappings' })
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Get('/events/mappings')
	async getEventMappings() {
		try {
			return await this.simService.getEventMappings();
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get SIM event mappings', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to get SIM event mappings', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Set an event-to-workflow mapping.
	 */
	@ApiOperation({ summary: 'Set an event-to-workflow mapping for automatic workflow triggers' })
	@ApiResponse({ status: 200, description: 'Event mapping saved' })
	@ApiResponse({ status: 404, description: 'SIM integration not found' })
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Post('/events/mappings')
	@HttpCode(HttpStatus.OK)
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async setEventMapping(@Body() body: EventMappingDto) {
		try {
			await this.simService.setEventMapping(body.event, body.workflowId);
			return { event: body.event, workflowId: body.workflowId };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to set SIM event mapping', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to set SIM event mapping', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Remove an event-to-workflow mapping.
	 */
	@ApiOperation({ summary: 'Remove an event-to-workflow mapping' })
	@ApiResponse({ status: 200, description: 'Event mapping removed' })
	@ApiResponse({ status: 404, description: 'SIM integration not found' })
	@ApiParam({ name: 'event', description: 'The event type to unmap (e.g., timer.started)' })
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Delete('/events/mappings/:event')
	async removeEventMapping(@Param('event') event: string) {
		try {
			await this.simService.removeEventMapping(event as any);
			return { removed: true, event };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to remove SIM event mapping', { message: error?.message, stack: error?.stack });
			throw new HttpException('Failed to remove SIM event mapping', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
