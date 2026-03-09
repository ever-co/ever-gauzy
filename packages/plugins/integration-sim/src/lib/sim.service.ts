import {
	Injectable,
	BadRequestException,
	NotFoundException,
	Logger,
	HttpException,
	InternalServerErrorException
} from '@nestjs/common';
import { IntegrationEnum, IIntegration, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import type { WorkflowExecutionResult, AsyncExecutionResult } from 'simstudio-ts-sdk';
import { ConfigService } from '@gauzy/config';
import { IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import { SimClientFactory } from './sim-client.factory';
import { SimRepositoryService } from './sim-repository.service';
import { SimWorkflowExecution } from './sim-workflow-execution.entity';
import { SIM_DEFAULT_BASE_URL } from './sim.config';
import { IConfigureSimInput, IExecuteWorkflowInput, ISimIntegrationSettings, SimSettingName } from './interfaces';
import { SimEventType } from './dto/event-mapping.dto';

@Injectable()
export class SimService {
	private readonly logger = new Logger(SimService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly simClientFactory: SimClientFactory,
		private readonly simRepositoryService: SimRepositoryService
	) {}

	/**
	 * Get API key for SIM API calls.
	 * Looks for a tenant-specific API key in the database first, then falls back to global config.
	 * @param integrationTenantId - The integration tenant ID (not the base integration ID)
	 */
	async getApiKey(integrationTenantId?: string): Promise<string> {
		try {
			// 1. Try tenant-specific API key from database
			if (integrationTenantId) {
				const tenantId = RequestContext.currentTenantId();
				if (!tenantId) {
					throw new BadRequestException('Tenant ID not found in request context');
				}

				let integrationTenant: IIntegrationTenant | null = null;
				try {
					integrationTenant = await this.integrationTenantService.findOneByOptions({
						where: { id: integrationTenantId, tenantId },
						relations: ['settings']
					});
				} catch (error) {
					if (!(error instanceof NotFoundException)) {
						throw error;
					}
				}

				const apiKeySetting = integrationTenant?.settings?.find(
					(s: IIntegrationSetting) => s.settingsName === SimSettingName.API_KEY
				);

				if (apiKeySetting?.settingsValue) {
					return apiKeySetting.settingsValue;
				}
			}

			// 2. Fallback to global config (GAUZY_SIM_API_KEY environment variable)
			const globalApiKey = this.configService.get('sim')?.apiKey;
			if (globalApiKey) {
				return globalApiKey;
			}

			throw new InternalServerErrorException(
				'SIM API key is not configured. Set GAUZY_SIM_API_KEY or run setupIntegration first.'
			);
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error(`Failed to get SIM API key: ${error.message}`);
			throw new InternalServerErrorException('Failed to get SIM API key');
		}
	}

	/**
	 * Configure SIM integration for the current tenant.
	 */
	async configureIntegration(input: IConfigureSimInput): Promise<{ integrationTenantId: string }> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			const { apiKey, organizationId } = input;

			// Find or create the base integration
			let integration: IIntegration | null = null;
			try {
				integration = await this.integrationService.findOneByOptions({
					where: { provider: IntegrationEnum.SIM }
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			if (!integration) {
				integration = await this.integrationService.create({
					provider: IntegrationEnum.SIM,
					name: IntegrationEnum.SIM
				});
			}

			// Define the settings to save
			const settings = [
				{
					settingsName: SimSettingName.API_KEY,
					settingsValue: apiKey,
					tenantId,
					organizationId
				},
				{
					settingsName: SimSettingName.IS_ENABLED,
					settingsValue: JSON.stringify(true),
					tenantId,
					organizationId
				}
			];

			// Look up an existing integration tenant for this tenant/org
			let existingTenant: IIntegrationTenant | null = null;
			try {
				existingTenant = await this.integrationTenantService.findOneByOptions({
					where: {
						tenantId,
						integration: { provider: IntegrationEnum.SIM }
					},
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			let integrationTenantId: string;

			if (existingTenant?.id) {
				// Update existing tenant's settings by merging/replacing
				const existingSettings: IIntegrationSetting[] = existingTenant.settings ?? [];
				const settingsByName = new Map<string, (typeof settings)[number]>(settings.map((s) => [s.settingsName, s]));

				// Update existing rows in-place and track which were updated
				const updatedNames = new Set<string>();
				const mergedSettings = existingSettings.map((existing: IIntegrationSetting) => {
					const update = settingsByName.get(existing.settingsName);
					if (update) {
						updatedNames.add(existing.settingsName);
						return { ...existing, settingsValue: update.settingsValue };
					}
					return existing;
				});

				// Append truly new settings that had no pre-existing row
				for (const [name, setting] of settingsByName) {
					if (!updatedNames.has(name)) {
						mergedSettings.push(setting);
					}
				}

				await this.integrationTenantService.save({
					...existingTenant,
					settings: mergedSettings
				});

				integrationTenantId = existingTenant.id;

				// Invalidate cached client to pick up new credentials
				this.simClientFactory.invalidateClient(integrationTenantId);
			} else {
				// Create a new integration tenant
				const integrationTenant = await this.integrationTenantService.create({
					name: IntegrationEnum.SIM,
					integration,
					tenantId,
					organizationId,
					settings
				});

				if (!integrationTenant.id) {
					throw new BadRequestException('Failed to create integration tenant: missing ID');
				}

				integrationTenantId = integrationTenant.id;
			}

			this.logger.log(
				`SIM integration configured for tenant ${tenantId}. ` +
					`Integration tenant ID: ${integrationTenantId}`
			);

			return { integrationTenantId };
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to configure SIM integration:', error);
			throw new InternalServerErrorException('Failed to configure SIM integration');
		}
	}

	/**
	 * Execute a SIM workflow for the current tenant.
	 */
	async executeWorkflow(input: IExecuteWorkflowInput): Promise<WorkflowExecutionResult | AsyncExecutionResult> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		// Find integration for current tenant
		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { name: IntegrationEnum.SIM, tenantId },
				relations: ['settings']
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant?.id) {
			throw new NotFoundException('SIM integration not found for current tenant');
		}

		// Verify integration is enabled using the already-loaded settings
		const enabledSetting = integrationTenant.settings?.find(
			(s: IIntegrationSetting) => s.settingsName === SimSettingName.IS_ENABLED
		);
		if (!this.parseEnabledSetting(enabledSetting?.settingsValue)) {
			throw new BadRequestException('SIM integration is disabled for current tenant');
		}

		// Get tenant-scoped SIM client
		const client = await this.simClientFactory.getClient(integrationTenant.id);

		// Create execution log entry
		const execution = await this.simRepositoryService.create({
			workflowId: input.workflowId,
			status: 'processing',
			input: input.input,
			triggeredBy: input.triggeredBy || 'manual',
			integrationId: integrationTenant.id,
			tenantId,
			organizationId: integrationTenant.organizationId
		});

		try {
			// The simstudio-ts-sdk does not handle SSE streaming responses —
			// it always parses the response as JSON via response.json(), which fails
			// on the SSE "data: ..." text format. Reject streaming requests early.
			if (input.stream) {
				throw new BadRequestException(
					'Streaming mode is not supported. The SIM SDK does not handle SSE responses. ' +
						'Use runAsync: true for long-running workflows instead.'
				);
			}

			this.logger.debug(
				`Executing workflow: POST ${SIM_DEFAULT_BASE_URL}/api/workflows/${input.workflowId}/execute | ` +
					`async: ${input.runAsync || false}`
			);

			const result = await client.executeWithRetry(
				input.workflowId,
				input.input,
				{
					timeout: input.timeout || 30000,
					async: input.runAsync || false
				},
				{ maxRetries: 3, initialDelay: 1000, maxDelay: 30000, backoffMultiplier: 2 }
			);

			this.logger.debug(`Workflow execution completed for workflow: ${input.workflowId}`);

			// Update execution log — handle both sync and async response shapes
			this.mapExecutionResult(execution, result);
			await this.simRepositoryService.save(execution);

			return result;
		} catch (error: any) {
			// Update execution log with failure
			execution.status = 'failed';
			execution.error = { message: error.message, ...(error.code ? { code: error.code } : {}) };
			await this.simRepositoryService.save(execution);

			this.logger.error(`Workflow execution failed: ${error.message}`, {
				workflowId: input.workflowId,
				tenantId,
				error: error.message
			});

			if (error instanceof HttpException) {
				throw error;
			}
			throw new InternalServerErrorException('Workflow execution failed');
		}
	}

	/**
	 * Get async job status.
	 */
	async getJobStatus(taskId: string): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { name: IntegrationEnum.SIM, tenantId }
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant?.id) {
			throw new NotFoundException('SIM integration not found for current tenant');
		}

		const client = await this.simClientFactory.getClient(integrationTenant.id);
		return client.getJobStatus(taskId);
	}

	/**
	 * Validate a workflow is deployed and ready.
	 */
	async validateWorkflow(workflowId: string): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { name: IntegrationEnum.SIM, tenantId }
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant?.id) {
			throw new NotFoundException('SIM integration not found for current tenant');
		}

		const client = await this.simClientFactory.getClient(integrationTenant.id);
		return client.validateWorkflow(workflowId);
	}

	/**
	 * Get integration settings (sanitized, no API key exposed).
	 */
	async getIntegrationSettings(): Promise<ISimIntegrationSettings> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID not found in request context');
		}

		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { name: IntegrationEnum.SIM, tenantId },
				relations: ['settings']
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant) {
			return { isEnabled: false, hasApiKey: false };
		}

		const enabledSetting = integrationTenant.settings?.find(
			(s: IIntegrationSetting) => s.settingsName === SimSettingName.IS_ENABLED
		);
		const apiKeySetting = integrationTenant.settings?.find(
			(s: IIntegrationSetting) => s.settingsName === SimSettingName.API_KEY
		);

		const isEnabled = this.parseEnabledSetting(enabledSetting?.settingsValue);

		return {
			isEnabled,
			hasApiKey: !!apiKeySetting?.settingsValue
		};
	}

	/**
	 * Get execution history for the current tenant.
	 */
	async getExecutionHistory(options?: {
		workflowId?: string;
		status?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ data: SimWorkflowExecution[]; total: number }> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		const where: any = { tenantId };
		if (options?.workflowId) where.workflowId = options.workflowId;
		if (options?.status) where.status = options.status;

		const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
		const offset = Math.max(options?.offset || 0, 0);

		const { items, total } = await this.simRepositoryService.findAll({
			where,
			order: { createdAt: 'DESC' },
			take: limit,
			skip: offset
		});

		return { data: items, total };
	}

	/**
	 * Check if SIM integration is enabled for a given integration tenant.
	 */
	async isIntegrationEnabled(integrationTenantId: string): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID not found in request context');
		}

		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationTenantId, tenantId },
				relations: ['settings']
			});
		} catch (error) {
			if (error instanceof NotFoundException) {
				return false;
			}
			throw error;
		}

		if (!integrationTenant) {
			return false;
		}

		const enabledSetting = integrationTenant.settings?.find(
			(s: IIntegrationSetting) => s.settingsName === SimSettingName.IS_ENABLED
		);

		return this.parseEnabledSetting(enabledSetting?.settingsValue);
	}

	/**
	 * Set an event-to-workflow mapping for the current tenant.
	 * When the specified Gauzy event fires, the mapped SIM workflow will be triggered automatically.
	 */
	async setEventMapping(event: SimEventType, workflowId: string): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { name: IntegrationEnum.SIM, tenantId },
				relations: ['settings']
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant?.id) {
			throw new NotFoundException('SIM integration not found for current tenant');
		}

		const settingsName = `event_mapping_${event}`;
		const existingSettings: IIntegrationSetting[] = integrationTenant.settings ?? [];

		// Update or append
		const existingIndex = existingSettings.findIndex(
			(s: IIntegrationSetting) => s.settingsName === settingsName
		);

		if (existingIndex >= 0) {
			existingSettings[existingIndex] = {
				...existingSettings[existingIndex],
				settingsValue: workflowId
			};
		} else {
			existingSettings.push({
				settingsName,
				settingsValue: workflowId,
				tenantId,
				organizationId: integrationTenant.organizationId
			} as IIntegrationSetting);
		}

		await this.integrationTenantService.save({
			...integrationTenant,
			settings: existingSettings
		});

		this.logger.log(`Event mapping set: ${event} -> ${workflowId} for tenant ${tenantId}`);
	}

	/**
	 * Remove an event-to-workflow mapping for the current tenant.
	 */
	async removeEventMapping(event: SimEventType): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { name: IntegrationEnum.SIM, tenantId },
				relations: ['settings']
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant?.id) {
			throw new NotFoundException('SIM integration not found for current tenant');
		}

		const settingsName = `event_mapping_${event}`;
		const filteredSettings = (integrationTenant.settings ?? []).filter(
			(s: IIntegrationSetting) => s.settingsName !== settingsName
		);

		await this.integrationTenantService.save({
			...integrationTenant,
			settings: filteredSettings
		});

		this.logger.log(`Event mapping removed: ${event} for tenant ${tenantId}`);
	}

	/**
	 * Get all event-to-workflow mappings for the current tenant.
	 */
	async getEventMappings(): Promise<{ event: string; workflowId: string }[]> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		let integrationTenant: IIntegrationTenant | null = null;
		try {
			integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: { name: IntegrationEnum.SIM, tenantId },
				relations: ['settings']
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}

		if (!integrationTenant?.id) {
			return [];
		}

		const prefix = 'event_mapping_';
		return (integrationTenant.settings ?? [])
			.filter((s: IIntegrationSetting) => s.settingsName.startsWith(prefix) && !!s.settingsValue)
			.map((s: IIntegrationSetting) => ({
				event: s.settingsName.substring(prefix.length),
				workflowId: s.settingsValue
			}));
	}

	/**
	 * Get the list of supported event types for workflow triggers.
	 */
	getSupportedEvents(): { event: string; description: string }[] {
		return [
			{ event: 'timer.started', description: 'Triggered when an employee starts their timer' },
			{ event: 'timer.stopped', description: 'Triggered when an employee stops their timer' },
			{ event: 'timer.status_updated', description: 'Triggered when a timer status is queried and updated' },
			{ event: 'task.created', description: 'Triggered when a new task is created' },
			{ event: 'task.updated', description: 'Triggered when a task is updated' },
			{ event: 'task.deleted', description: 'Triggered when a task is deleted' },
			{ event: 'screenshot.created', description: 'Triggered when a new screenshot is captured' },
			{ event: 'screenshot.updated', description: 'Triggered when a screenshot is updated' },
			{ event: 'screenshot.deleted', description: 'Triggered when a screenshot is deleted' },
			{ event: 'integration.created', description: 'Triggered when a new integration is created' },
			{ event: 'integration.updated', description: 'Triggered when an integration is updated' },
			{ event: 'integration.deleted', description: 'Triggered when an integration is deleted' },
			{ event: 'account.registered', description: 'Triggered when a new account is registered' },
			{ event: 'account.verified', description: 'Triggered when an account is verified' }
		];
	}

	/**
	 * Trigger a workflow from an internal Gauzy event.
	 */
	async triggerEventWorkflow(params: {
		event: string;
		data: any;
		tenantId: string;
		organizationId: string;
	}): Promise<void> {
		try {
			let integrationTenant: IIntegrationTenant | null = null;
			try {
				integrationTenant = await this.integrationTenantService.findOneByOptions({
					where: { name: IntegrationEnum.SIM, tenantId: params.tenantId },
					relations: ['settings']
				});
			} catch (error) {
				if (!(error instanceof NotFoundException)) {
					throw error;
				}
			}

			if (!integrationTenant?.id) return; // SIM not configured for this tenant

			// Check if integration is enabled
			const isEnabled = integrationTenant.settings?.find(
				(s: IIntegrationSetting) => s.settingsName === SimSettingName.IS_ENABLED
			)?.settingsValue;

			const enabled = this.parseEnabledSetting(isEnabled);
			if (!enabled) return;

			// Find the workflow ID mapped to this event
			const eventMappingSetting = integrationTenant.settings?.find(
				(s: IIntegrationSetting) => s.settingsName === `event_mapping_${params.event}`
			);

			if (!eventMappingSetting?.settingsValue) return;

			const workflowId = eventMappingSetting.settingsValue;
			const client = await this.simClientFactory.getClient(integrationTenant.id);

			// Create execution log entry
			const execution = await this.simRepositoryService.create({
				workflowId,
				status: 'queued',
				input: params.data,
				triggeredBy: 'event',
				integrationId: integrationTenant.id,
				tenantId: params.tenantId,
				organizationId: params.organizationId
			});

			try {
				// Execute asynchronously
				const result = await client.executeWithRetry(
					workflowId,
					params.data,
					{ async: true },
					{ maxRetries: 3, initialDelay: 1000, maxDelay: 30000, backoffMultiplier: 2 }
				);

				// Update execution log with result
				this.mapExecutionResult(execution, result);
				await this.simRepositoryService.save(execution);
			} catch (execError: any) {
				// Update execution log with failure
				execution.status = 'failed';
				execution.error = { message: execError.message, ...(execError.code ? { code: execError.code } : {}) };
				await this.simRepositoryService.save(execution);
				throw execError;
			}

			this.logger.log(`Event workflow triggered: ${params.event} -> ${workflowId}`);
		} catch (error: any) {
			this.logger.error(`Failed to trigger event workflow: ${error.message}`, {
				event: params.event,
				tenantId: params.tenantId
			});
		}
	}

	/**
	 * Map a SIM API execution result onto a SimWorkflowExecution entity.
	 * Handles both sync and async response shapes.
	 */
	private mapExecutionResult(execution: SimWorkflowExecution, result: WorkflowExecutionResult | AsyncExecutionResult): void {
		const syncResult = result as WorkflowExecutionResult;
		const asyncResult = result as AsyncExecutionResult;
		const resultAny = result as Record<string, any>;
		const taskId = asyncResult.taskId;

		if (taskId) {
			execution.status = 'queued';
		} else if (syncResult.success === true) {
			execution.status = 'completed';
		} else if (syncResult.success === false) {
			execution.status = 'failed';
		} else {
			execution.status = 'completed';
		}

		execution.output = syncResult.output ?? result;

		// Extract executionId — check metadata (SDK type), root level (API may return it there), or async taskId
		execution.executionId = syncResult.metadata?.executionId ?? resultAny['executionId'] ?? taskId;

		// Extract duration — check metadata (SDK type), totalDuration, or root level
		execution.duration = syncResult.metadata?.duration ?? syncResult.totalDuration ?? resultAny['duration'];

		execution.error = syncResult.error ? { message: syncResult.error } : undefined;
	}

	/**
	 * Parse a setting value that may be stored as a boolean or a JSON-encoded string into a boolean.
	 */
	private parseEnabledSetting(value: unknown): boolean {
		if (typeof value === 'boolean') return value;
		if (typeof value === 'string') {
			try {
				return !!JSON.parse(value);
			} catch {
				return false;
			}
		}
		return !!value;
	}

	/**
	 * Get integration tenant information (with sensitive settings redacted).
	 */
	async getIntegrationTenant(integrationTenantId: string): Promise<IIntegrationTenant> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			const integrationTenant = await this.integrationTenantService.findOneByOptions({
				where: {
					id: integrationTenantId,
					tenantId
				},
				relations: ['integration', 'settings']
			});

			// Redact sensitive settings before returning
			if (integrationTenant.settings) {
				integrationTenant.settings = integrationTenant.settings.map((setting: IIntegrationSetting) => {
					if (setting.settingsName === SimSettingName.API_KEY) {
						return { ...setting, settingsValue: '••••••••' };
					}
					return setting;
				});
			}

			return integrationTenant;
		} catch (error: any) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.logger.error('Failed to get SIM integration tenant:', error);
			throw new InternalServerErrorException('Failed to get SIM integration tenant');
		}
	}
}
