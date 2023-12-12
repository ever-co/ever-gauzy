import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { GauzyAIService, ImageAnalysisResult } from '@gauzy/integration-ai';
import { IScreenshot, IntegrationEnum, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TenantAwareCrudService } from './../../core/crud';
import { IntegrationTenantService } from './../../integration-tenant/integration-tenant.service';
import { Screenshot } from './screenshot.entity';

@Injectable()
export class ScreenshotService extends TenantAwareCrudService<Screenshot> {

	constructor(
		@InjectRepository(Screenshot) protected readonly screenshotRepository: Repository<Screenshot>,
		/** */
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _gauzyAIService: GauzyAIService,
	) {
		super(screenshotRepository);
	}

	/**
	 * DELETE screenshot by ID
	 *
	 * @param criteria
	 * @param options
	 * @returns
	 */
	async deleteScreenshot(
		id: IScreenshot['id'],
		options?: FindOptionsWhere<Screenshot>
	): Promise<IScreenshot> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const query = this.repository.createQueryBuilder(this.alias);
			query.setFindOptions({
				where: {
					...(
						(options) ? options : {}
					),
					id,
					tenantId
				}
			});
			if (!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)) {
				query.leftJoin(`${query.alias}.timeSlot`, 'time_slot');
				query.andWhere(`"time_slot"."employeeId" = :employeeId`, {
					employeeId: RequestContext.currentEmployeeId()
				});
			}
			const screenshot = await query.getOneOrFail();
			return await this.repository.remove(screenshot);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * Analyze a screenshot using Gauzy AI service.
	 * @param input - The input options for the screenshot.
	 * @param data - The screenshot data.
	 * @param file - The screenshot file.
	 * @param callback - Optional callback function to handle the analysis result.
	 * @returns Promise<ImageAnalysisResult>
	 */
	async analyzeScreenshot(
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

			console.log('AI Integration Tenant: %s', integration);

			// Check if integration exists
			if (!!integration) {
				console.log('Screenshot/Image Analyze Starting');

				// Analyze image using Gauzy AI service
				const [analysis] = await this._gauzyAIService.analyzeImage(data, file);

				if (analysis.success && callback) {
					// Call the callback function if provided
					callback(analysis.data.analysis);
				}

				return analysis;
			}
		} catch (error) {
			// If needed, consider throwing or handling the error appropriately.
			console.log('Failed to get AI Integration for provided options: %s', error?.message);
		}
	}
}
