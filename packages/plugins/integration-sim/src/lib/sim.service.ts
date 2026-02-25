import {
	Injectable,
	BadRequestException,
	NotFoundException,
	Logger,
	HttpException,
	HttpStatus,
	InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationEnum, IIntegrationSetting } from '@gauzy/contracts';
import { ConfigService } from '@gauzy/config';
import { IntegrationService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import { SimClientFactory } from './sim-client.factory';
import { SimWorkflowExecution } from './sim-workflow-execution.entity';
import { IConfigureSimInput, IExecuteWorkflowInput, ISimIntegrationSettings, SimSettingName } from './interfaces';

@Injectable()
export class SimService {
	private readonly logger = new Logger(SimService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly simClientFactory: SimClientFactory,
		@InjectRepository(SimWorkflowExecution)
		private readonly executionRepository: Repository<SimWorkflowExecution>
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

				let integrationTenant: any = null;
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
					(s: any) => s.settingsName === SimSettingName.API_KEY
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
			throw new HttpException(
				`Failed to get SIM API key: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
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
			let integration: any = null;
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
			let existingTenant: any = null;
			try {
				existingTenant = await this.integrationTenantService.findOneByOptions({
					where: {
						tenantId,
						...(organizationId ? { organizationId } : {}),
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
				const existingSettings: any[] = existingTenant.settings ?? [];
				const settingsByName = new Map(settings.map((s) => [s.settingsName, s]));

				// Update existing rows in-place and track which were updated
				const updatedNames = new Set<string>();
				const mergedSettings = existingSettings.map((existing: any) => {
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
	async executeWorkflow(input: IExecuteWorkflowInput): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		// Find integration for current tenant
		let integrationTenant: any = null;
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

		// Get tenant-scoped SIM client
		const client = await this.simClientFactory.getClient(integrationTenant.id);

		// Create execution log entry
		const execution = this.executionRepository.create({
			workflowId: input.workflowId,
			status: 'processing',
			input: input.input,
			triggeredBy: input.triggeredBy || 'manual',
			integrationId: integrationTenant.id,
			tenantId,
			organizationId: integrationTenant.organizationId
		});
		await this.executionRepository.save(execution);

		try {
			const result = await client.executeWithRetry(
				input.workflowId,
				input.input,
				{
					timeout: input.timeout || 30000,
					stream: input.stream || false,
					async: input.async || false
				},
				{ maxRetries: 3, initialDelay: 1000, maxDelay: 30000, backoffMultiplier: 2 }
			);

			// Update execution log
			execution.status = (result as any).success ? 'completed' : 'failed';
			execution.output = (result as any).output;
			execution.executionId = (result as any).metadata?.executionId || (result as any).taskId;
			execution.duration = (result as any).metadata?.duration || (result as any).totalDuration;
			execution.error = (result as any).error ? { message: (result as any).error } : undefined;
			await this.executionRepository.save(execution);

			return result;
		} catch (error: any) {
			// Update execution log with failure
			execution.status = 'failed';
			execution.error = { message: error.message, code: error.code };
			await this.executionRepository.save(execution);

			this.logger.error(`Workflow execution failed: ${error.message}`, {
				workflowId: input.workflowId,
				tenantId,
				error: error.message
			});

			throw new HttpException(
				`Workflow execution failed: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
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

		let integrationTenant: any = null;
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

		let integrationTenant: any = null;
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

		let integrationTenant: any = null;
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

		const isEnabled = !!(typeof enabledSetting?.settingsValue === 'string'
			? JSON.parse(enabledSetting.settingsValue)
			: enabledSetting?.settingsValue);

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

		const [data, total] = await this.executionRepository.findAndCount({
			where,
			order: { createdAt: 'DESC' },
			take: options?.limit || 20,
			skip: options?.offset || 0
		});

		return { data, total };
	}

	/**
	 * Check if SIM integration is enabled for a given integration tenant.
	 */
	async isIntegrationEnabled(integrationTenantId: string): Promise<boolean> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			let integrationTenant: any = null;
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

			if (!integrationTenant) {
				return false;
			}

			const enabledSetting = integrationTenant.settings?.find(
				(s: any) => s.settingsName === SimSettingName.IS_ENABLED
			);

			if (typeof enabledSetting?.settingsValue === 'boolean') {
				return enabledSetting.settingsValue;
			}
			return !!(typeof enabledSetting?.settingsValue === 'string'
				? JSON.parse(enabledSetting.settingsValue)
				: enabledSetting?.settingsValue);
		} catch (error) {
			this.logger.error('Error checking if SIM integration is enabled:', error);
			return false;
		}
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
			let integrationTenant: any = null;
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

			const enabled = !!(typeof isEnabled === 'string' ? JSON.parse(isEnabled) : isEnabled);
			if (!enabled) return;

			// Find the workflow ID mapped to this event
			const eventMappingSetting = integrationTenant.settings?.find(
				(s: IIntegrationSetting) => s.settingsName === `event_mapping_${params.event}`
			);

			if (!eventMappingSetting?.settingsValue) return;

			const workflowId = eventMappingSetting.settingsValue;
			const client = await this.simClientFactory.getClient(integrationTenant.id);

			// Execute asynchronously
			await client.executeWorkflow(workflowId, params.data, {
				async: true
			});

			this.logger.log(`Event workflow triggered: ${params.event} -> ${workflowId}`);
		} catch (error: any) {
			this.logger.error(`Failed to trigger event workflow: ${error.message}`, {
				event: params.event,
				tenantId: params.tenantId
			});
		}
	}

	/**
	 * Get integration tenant information.
	 */
	async getIntegrationTenant(integrationId: string): Promise<any> {
		try {
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID not found in request context');
			}

			return await this.integrationTenantService.findOneByOptions({
				where: {
					tenantId,
					integration: { id: integrationId }
				},
				relations: ['integration', 'settings']
			});
		} catch (error: any) {
			this.logger.error('Failed to get SIM integration tenant:', error);
			throw new HttpException(
				`Failed to get SIM integration tenant: ${error.message}`,
				error.status || HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
