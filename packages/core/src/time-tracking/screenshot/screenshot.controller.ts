import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	UseInterceptors,
	Delete,
	Param,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import * as path from 'path';
import * as moment from 'moment';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';
import * as Jimp from 'jimp';
import { ImageAnalysisResult } from '@gauzy/integration-ai';
import { FileStorageProviderEnum, IScreenshot, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import { Screenshot } from './screenshot.entity';
import { ScreenshotService } from './screenshot.service';
import { RequestContext } from './../../core/context';
import { FileStorage, UploadedFileStorage } from '../../core/file-storage';
import { tempFile } from '../../core/utils';
import { LazyFileInterceptor } from './../../core/interceptors';
import { Permissions } from './../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { DeleteQueryDTO } from './../../shared/dto';

@ApiTags('Screenshot')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller()
export class ScreenshotController {
	constructor(private readonly _screenshotService: ScreenshotService) { }

	/**
	 *
	 * @param entity
	 * @param file
	 * @returns
	 */
	@ApiOperation({ summary: 'Create start/stop screenshot.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The screenshot has been successfully captured.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UseInterceptors(
		// Use LazyFileInterceptor for handling file uploads with custom storage settings
		LazyFileInterceptor('file', {
			// Define storage settings for uploaded files
			storage: () => {
				// Define the base directory for storing screenshots
				const baseDirectory = path.join('screenshots', moment().format('YYYY/MM/DD'));

				// Generate unique sub directories based on the current tenant and employee IDs
				const subDirectory = path.join(
					RequestContext.currentTenantId() || uuid(),
					RequestContext.currentEmployeeId() || uuid()
				);

				return new FileStorage().storage({
					dest: () => path.join(baseDirectory, subDirectory),
					prefix: 'screenshots'
				});
			}
		})
	)
	async create(@Body() input: Screenshot, @UploadedFileStorage() file: UploadedFile) {
		if (!file.key) {
			console.warn('Screenshot file key is empty');
			return;
		}

		console.log('Screenshot Http Request Input: ', { input });

		// Extract user information from the request context
		const user = RequestContext.currentUser();

		try {
			// Extract necessary properties from the request body
			const { organizationId } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Initialize file storage provider and process thumbnail
			const provider = new FileStorage().getProvider();

			// Retrieve file content from the file storage provider
			const fileContent = await provider.getFile(file.key);

			// Create temporary files for input and output of thumbnail processing
			const inputFile = await tempFile('screenshot-thumb');
			const outputFile = await tempFile('screenshot-thumb');

			// Write the file content to the input temporary file
			await fs.promises.writeFile(inputFile, fileContent);

			// Resize the image using Jimp library
			const image = await Jimp.read(inputFile);

			// we are using Jimp.AUTO for height instead of hardcode (e.g. 150px)
			image.resize(250, Jimp.AUTO);

			// Write the resized image to the output temporary file
			await image.writeAsync(outputFile);

			// Read the resized image data from the output temporary file
			const data = await fs.promises.readFile(outputFile);

			try {
				// Remove the temporary input and output files
				await fs.promises.unlink(inputFile);
				await fs.promises.unlink(outputFile);
			} catch (error) {
				console.error('Error while unlinking temp files:', error);
			}

			// Define thumbnail file name and directory
			const thumbName = `thumb-${file.filename}`;
			const thumbDir = path.dirname(file.key);

			// Replace double backslashes with single forward slashes
			const fullPath = path.join(thumbDir, thumbName).replace(/\\/g, '/');

			// Upload the thumbnail data to the file storage provider
			const thumb = await provider.putFile(data, fullPath);
			console.log(`Screenshot thumb created for employee (${user.name})`, thumb);

			// Populate entity properties for the screenshot
			const entity = new Screenshot({
				organizationId: organizationId,
				tenantId: tenantId,
				userId: RequestContext.currentUserId(),
				file: file.key,
				thumb: thumb.key,
				storageProvider: provider.name.toUpperCase(),
				timeSlotId: isUUID(input.timeSlotId) ? input.timeSlotId : null,
				recordedAt: input.recordedAt ? input.recordedAt : new Date()
			});

			console.log(`Screenshot entity for employee (${user.name})`, { entity });

			// Create the screenshot entity in the database
			const screenshot = await this._screenshotService.create(entity);
			console.log(`Screenshot created for employee (${user.name})`, screenshot);

			// Analyze image using Gauzy AI service
			this._screenshotService.analyzeScreenshot(
				screenshot,
				data,
				file,
				async (result: ImageAnalysisResult['data']['analysis']) => {
					try {
						if (result) {
							const [analysis] = result;
							console.log(`Screenshot analyze response: %s`, analysis);

							const isWorkRelated = analysis.work;
							const description = analysis.description || '';
							const apps = analysis.apps || [];

							await this._screenshotService.update(screenshot.id, {
								isWorkRelated,
								description,
								apps
							});
						}
					} catch (error) {
						console.error(`Error while analyzing screenshot for employee (${user.name})`, error);
					}
				}
			);

			return await this._screenshotService.findOneByIdString(screenshot.id);
		} catch (error) {
			console.error(`Error while creating screenshot for employee (${user.name})`, error);
		}
	}

	/**
	 *
	 * @param screenshotId
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Delete record'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.DELETE_SCREENSHOTS)
	@Delete(':id')
	@UseValidationPipe()
	async delete(
		@Param('id', UUIDValidationPipe) screenshotId: IScreenshot['id'],
		@Query() options: DeleteQueryDTO<Screenshot>
	): Promise<IScreenshot> {
		return await this._screenshotService.deleteScreenshot(screenshotId, options);
	}
}
