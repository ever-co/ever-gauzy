import { Injectable } from '@nestjs/common';
import { IntegrationEntity, IntegrationEnum, IScreenshot, UploadedFile } from '@gauzy/contracts';
import {
	ConnectionEntityManager,
	IntegrationTenantService,
	RequestContext,
	Screenshot,
	ScreenshotEvent
} from '@gauzy/core';
import { GauzyAIService, ImageAnalysisResult } from './gauzy-ai.service';

@Injectable()
export class IntegrationAIAnalysisService {
	constructor(
		private readonly _connectionEntityManager: ConnectionEntityManager,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _gauzyAIService: GauzyAIService
	) {}

	/**
	 * Analyze screenshot using Gauzy AI service.
	 *
	 * @param event The screenshot event containing necessary data.
	 */
	async analyzeAndSaveScreenshot(event: ScreenshotEvent) {
		const { entity, data, file } = event;
		const user = RequestContext.currentUser();

		// Analyze image using Gauzy AI service
		await this.analyzeImage(entity, data, file, async (result: ImageAnalysisResult['data']['analysis']) => {
			try {
				if (result) {
					const [analysis] = result;
					console.log(`Screenshot Analyze Response: %s`, analysis);

					const isWorkRelated = analysis.work;
					const description = analysis.description || '';
					const apps = analysis.apps || [];

					// Update screenshot entity
					await this._connectionEntityManager.getRepository(Screenshot).update(entity.id, {
						isWorkRelated,
						description,
						apps
					});
				}
			} catch (error) {
				console.log(`Image Analysis Failed. AI Integration Tenant For Employee: (${user.name})`, error);
			}
		});
	}

	/**
	 * Analyze an image using Gauzy AI service.
	 * @param input The screenshot input data.
	 * @param data The image data buffer.
	 * @param file The uploaded file information.
	 * @param callback The callback function to handle the analysis result.
	 * @returns The image analysis result.
	 */
	async analyzeImage(
		input: IScreenshot,
		data: Buffer,
		file: UploadedFile,
		callback?: (analysis: ImageAnalysisResult['data']['analysis']) => void
	): Promise<ImageAnalysisResult> {
		try {
			const { organizationId } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Retrieve integration
			const integration = await this._integrationTenantService.getIntegrationByOptions({
				organizationId,
				tenantId,
				name: IntegrationEnum.GAUZY_AI
			});

			// Check if integration exists
			if (!!integration) {
				try {
					console.log('Screenshot/Image Analyze Starting. AI Integration Tenant: %s', integration);
					const integrationId = integration['id'];

					// Check if employee performance analysis sync is enabled
					await this._integrationTenantService.findIntegrationTenantByEntity({
						integrationId,
						organizationId,
						entityType: IntegrationEntity.EMPLOYEE_PERFORMANCE
					});

					// Analyze image using Gauzy AI service
					const [analysis] = await this._gauzyAIService.analyzeImage(data, file);

					if (!analysis.success) {
						console.log('Screenshot/Image Analyze Failed. AI Integration Tenant: %s', integration);
					}

					if (analysis.success && callback) {
						// Call the callback function if provided
						callback(analysis.data.analysis);
					}

					return analysis;
				} catch (error) {
					console.log('Error while getting Integration for Gauzy AI', error.message);
					return null;
				}
			}

			return null;
		} catch (error) {
			// If needed, consider throwing or handling the error appropriately.
			console.error('Failed to get AI Integration for provided options: %s', error?.message);
		}
	}
}
