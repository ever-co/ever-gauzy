import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	UseInterceptors,
	Delete,
	Param,
	Query,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as path from 'path';
import * as moment from 'moment';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';
import * as Jimp from 'jimp';
import { GauzyAIService } from '@gauzy/integration-ai';
import {
	FileStorageProviderEnum,
	IScreenshot,
	IntegrationEnum,
	PermissionsEnum,
	UploadedFile,
} from '@gauzy/contracts';
import { Screenshot } from './screenshot.entity';
import { ScreenshotService } from './screenshot.service';
import { RequestContext } from './../../core/context';
import { FileStorage, UploadedFileStorage } from '../../core/file-storage';
import { tempFile } from '../../core/utils';
import { LazyFileInterceptor } from './../../core/interceptors';
import { Permissions } from './../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { DeleteQueryDTO } from './../../shared/dto';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';

@ApiTags('Screenshot')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller()
export class ScreenshotController {

	constructor(
		private readonly _screenshotService: ScreenshotService,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	/**
	 *
	 * @param entity
	 * @param file
	 * @returns
	 */
	@ApiOperation({ summary: 'Create start/stop screenshot.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The screenshot has been successfully captured.',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong',
	})
	@Post()
	@UseInterceptors(
		// Use the LazyFileInterceptor to handle file uploads
		LazyFileInterceptor('file', {
			// Define storage settings for uploaded files
			storage: () => {
				return new FileStorage().storage({
					dest: () => path.join(
						'screenshots',
						moment().format('YYYY/MM/DD'),
						RequestContext.currentTenantId() || uuid()
					),
					prefix: 'screenshots',
				});
			},
		})
	)
	async create(
		@Body() entity: Screenshot,
		@UploadedFileStorage() file: UploadedFile
	) {
		// Extract necessary properties from the request body
		const { organizationId } = entity;
		const tenantId = RequestContext.currentTenantId() || entity.tenantId;

		// Extract user information from the request context
		const user = RequestContext.currentUser();
		const provider = new FileStorage().getProvider();
		let thumb: UploadedFile;

		/** */
		let data: Buffer;

		try {
			// Process the thumbnail

			const fileContent = await provider.getFile(file.key);

			const inputFile = await tempFile('screenshot-thumb');
			const outputFile = await tempFile('screenshot-thumb');

			await fs.promises.writeFile(inputFile, fileContent);

			await new Promise(async (resolve, reject) => {
				const image = await Jimp.read(inputFile);

				// we are using Jimp.AUTO for height instead of hardcode (e.g. 150px)
				image.resize(250, Jimp.AUTO);

				try {
					await image.writeAsync(outputFile);
					resolve(image);
				} catch (error) {
					reject(error);
				}
			});

			data = await fs.promises.readFile(outputFile);

			await fs.promises.unlink(inputFile);
			await fs.promises.unlink(outputFile);

			const thumbName = `thumb-${file.filename}`;
			const thumbDir = path.dirname(file.key);

			thumb = await provider.putFile(data, path.join(thumbDir, thumbName));
			console.log(`Screenshot thumb created for employee (${user.name})`, thumb);
		} catch (error) {
			console.log('Error while uploading screenshot into file storage provider:', error);
		}

		try {
			// Retrieve integration
			const integration = await this._integrationTenantService.getIntegrationByOptions({
				organizationId,
				tenantId,
				name: IntegrationEnum.GAUZY_AI
			});

			// Check if integration exists
			if (!!integration) {
				// Analyze image using Gauzy AI service
				const [analysis] = await this._gauzyAIService.analyzeImage(data, file);
				if (!!analysis.success) {
					const [analyzeImage] = analysis.data.analysis;

					entity.isWorkRelated = analyzeImage.work;
					entity.description = analyzeImage.description;
					/** */
					entity.apps = analyzeImage.apps;
				}
			}
		} catch (error) { }

		try {
			entity.organizationId = organizationId;
			entity.tenantId = tenantId;
			entity.userId = RequestContext.currentUserId();
			entity.file = file.key;
			entity.thumb = thumb.key;
			entity.storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;
			entity.recordedAt = entity.recordedAt ? entity.recordedAt : new Date();

			console.log({ entity });
			const screenshot = await this._screenshotService.create(entity);
			console.log(`Screenshot created for employee (${user.name})`, screenshot);
			return await this._screenshotService.findOneByIdString(screenshot.id);
		} catch (error) {
			console.log(`Error while creating screenshot for employee (${user.name})`, error);
		}
	}

	/**
	 *
	 * @param screenshotId
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Delete record',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Permissions(PermissionsEnum.DELETE_SCREENSHOTS)
	@Delete(':id')
	@UsePipes(new ValidationPipe())
	async delete(
		@Param('id', UUIDValidationPipe) screenshotId: IScreenshot['id'],
		@Query() options: DeleteQueryDTO<Screenshot>
	): Promise<IScreenshot> {
		return await this._screenshotService.deleteScreenshot(
			screenshotId,
			options
		);
	}
}
