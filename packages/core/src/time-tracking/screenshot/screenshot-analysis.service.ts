import { Injectable } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ImageAnalysisResult } from '@gauzy/integration-ai';
import { RequestContext } from '../../core/context';
import { ScreenshotService } from './screenshot.service';
import { ScreenshotEvent } from '../../event-bus/events';
import { Screenshot } from './screenshot.entity';

@Injectable()
export class ScreenshotAnalysisService {
	constructor(private readonly screenshotService: ScreenshotService) {}

	/**
	 * Analyze screenshot using Gauzy AI service.
	 *
	 * @param event The screenshot event containing necessary data.
	 */
	async analyzeAndSaveScreenshot(event: ScreenshotEvent) {
		const { entity, data, file } = event;
		const user = RequestContext.currentUser();

		// Analyze image using Gauzy AI service
		this.screenshotService.analyzeScreenshot(
			entity,
			data,
			file,
			async (result: ImageAnalysisResult['data']['analysis']) => {
				try {
					if (result) {
						const [analysis] = result;
						console.log(`Screenshot Analyze Response: %s`, analysis);

						const isWorkRelated = analysis.work;
						const description = analysis.description || '';
						const apps = analysis.apps || [];

						const partialEntity: QueryDeepPartialEntity<Screenshot> = {
							isWorkRelated,
							description,
							apps
						};

						await this.screenshotService.update(entity.id, partialEntity);
					}
				} catch (error) {
					console.error(`Error while analyzing screenshot for employee (${user.name})`, error);
				}
			}
		);
	}
}
