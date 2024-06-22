import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere } from 'typeorm';
import { i4netAIService, ImageAnalysisResult } from '@gauzy/integration-ai';
import { IScreenshot, IntegrationEntity, IntegrationEnum, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TenantAwareCrudService } from './../../core/crud';
import { IntegrationTenantService } from './../../integration-tenant/integration-tenant.service';
import { Screenshot } from './screenshot.entity';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { TypeOrmScreenshotRepository } from './repository/type-orm-screenshot.repository';
import { MikroOrmScreenshotRepository } from './repository/mikro-orm-screenshot.repository';

@Injectable()
export class ScreenshotService extends TenantAwareCrudService<Screenshot> {
	constructor(
		@InjectRepository(Screenshot)
		typeOrmScreenshotRepository: TypeOrmScreenshotRepository,

		mikroOrmScreenshotRepository: MikroOrmScreenshotRepository,

		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _gauzyAIService: i4netAIService
	) {
		super(typeOrmScreenshotRepository, mikroOrmScreenshotRepository);
	}

	/**
	 * DELETE screenshot by ID
	 *
	 * @param criteria
	 * @param options
	 * @returns
	 */
	async deleteScreenshot(id: IScreenshot['id'], options?: FindOptionsWhere<Screenshot>): Promise<IScreenshot> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.setFindOptions({
				where: {
					...(options ? options : {}),
					id,
					tenantId
				}
			});
			if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				query.leftJoin(`${query.alias}.timeSlot`, 'time_slot');
				query.andWhere(p(`"time_slot"."employeeId" = :employeeId`), {
					employeeId: RequestContext.currentEmployeeId()
				});
			}
			const screenshot = await query.getOneOrFail();
			return await this.typeOrmRepository.remove(screenshot);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * Analyze a screenshot using i4net AI service.
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
				name: IntegrationEnum.i4net_AI
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

					// Analyze image using i4net AI service
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
					console.log('Error while getting Integration for i4net AI', error.message);
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
