import {
	BadRequestException,
	Controller,
	InternalServerErrorException,
	Logger,
	PayloadTooLargeException,
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
import {
	createImageThumbnail,
	FileContentTooLargeError,
	fileContentToBuffer,
	thumbnailFileName
} from './../../core/file-storage/helpers/image-thumbnail';
import { ID, IScreenshot, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import { EventBus } from '../../event-bus/event-bus';
import { ScreenshotEvent } from '../../event-bus/events/screenshot.event';
import { BaseEntityEventTypeEnum } from '../../event-bus/base-entity-event';
import { RequestContext } from './../../core/context';
import {
	assertNotMarkupContent,
	FileStorage,
	FileStorageFactory,
	imageUploadFileFilter,
	UploadedFileStorage
} from '../../core/file-storage';
import { LazyFileInterceptor } from './../../core/interceptors';
import { Permissions } from './../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { DeleteScreenshotDTO } from './dto/delete-screenshot.dto';
import { Screenshot } from './screenshot.entity';
import { ScreenshotService } from './screenshot.service';

@ApiTags('Screenshot')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller('/timesheet/screenshot')
export class ScreenshotController {
	private readonly logger = new Logger(ScreenshotController.name);
	private logging: boolean = true;

	constructor(
		private readonly _screenshotService: ScreenshotService,
		private readonly _eventBus: EventBus
	) {}

	/**
	 * Capture a start/stop screenshot
	 *
	 * @param input The screenshot input data.
	 * @param file The uploaded file data.
	 * @returns The created screenshot entity.
	 */
	@ApiOperation({
		summary: 'Capture a start/stop screenshot',
		description:
			'Captures a screenshot when the timer is started or stopped. This API allows uploading the screenshot file along with related metadata.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Screenshot captured successfully.',
		type: Screenshot
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
	})
	@Post()
	@UseInterceptors(
		// Use LazyFileInterceptor for handling file uploads with custom storage settings
		LazyFileInterceptor('file', {
			// Define storage settings for uploaded files
			storage: () => FileStorageFactory.create('screenshots'),
			// Screenshots land under `uploads/screenshots` and are served unauthenticated from
			// `/public/<key>` with a Content-Type derived from the extension, so an `.svg`/`.html`
			// upload would execute script in the app origin — the same stored-XSS vector fixed on the
			// image-asset endpoint (GHSA-p334-cm7f-php5).
			fileFilter: imageUploadFileFilter
		})
	)
	async create(@Body() input: Screenshot, @UploadedFileStorage() file: UploadedFile) {
		if (!file.key) {
			this.logger.warn('Screenshot file key is empty');
			return;
		}

		if (this.logging) this.logger.log('Screenshot request received');

		// Extract user information from the request context
		const user = RequestContext.currentUser();
		// Extract necessary properties from the request body
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const organizationId = input.organizationId;
		const userId = RequestContext.currentUserId();

		// Initialize file storage provider and process thumbnail
		const provider = new FileStorage().getProvider();

		// Retrieve file content from the file storage provider (the S3-family providers return a stream)
		let fileContent: Buffer | undefined;
		try {
			fileContent = await fileContentToBuffer(await provider.getFile(file.key));
		} catch (error) {
			// Too large to read back (the route sets no multer size limit, so it is already stored): delete it, or it
			// stays served from `/public/` with no record to delete it through, and answer 413.
			if (error instanceof FileContentTooLargeError) {
				try {
					await provider.deleteFile(file.key);
				} catch {
					this.logger.error('Error while deleting an oversized screenshot from file storage provider');
				}
				throw new PayloadTooLargeException('The screenshot file is too large');
			}
			throw error;
		}

		// An empty upload (a display the desktop timer could not capture) has no image to record. Refuse it here,
		// OUTSIDE the try/catch below: in there the thumbnail step failed on it, the error was swallowed and the
		// client got a 201 with no screenshot while the 0-byte file stayed on disk.
		// A provider that could not read the object back returns nothing: that is a server-side failure, not a
		// success without a record (the file is kept — it may be readable on the client's retry).
		if (!fileContent) {
			this.logger.error(
				`Could not read the uploaded screenshot '${file.key}' back from the file storage provider`
			);
			throw new InternalServerErrorException('The uploaded screenshot could not be read back from storage');
		}
		if (fileContent.length === 0) {
			try {
				await provider.deleteFile(file.key);
			} catch {
				this.logger.error('Error while deleting an empty screenshot from file storage provider');
			}
			throw new BadRequestException('The screenshot file is empty');
		}

		// Content-based validation: the multer fileFilter only inspects the client-controlled MIME type
		// and filename, which can be spoofed. Re-check the actual stored bytes and reject markup that
		// would execute as stored XSS when served from `/public/<key>` (GHSA-p334-cm7f-php5). This runs
		// OUTSIDE the try/catch below, which swallows errors — a rejection must reach the client.
		// The file is deleted because `/public` serves from disk whether or not a DB record is created.
		try {
			assertNotMarkupContent(fileContent);
		} catch (error) {
			try {
				await provider.deleteFile(file.key);
			} catch {
				this.logger.error('Error while deleting rejected screenshot from file storage provider');
			}
			throw error;
		}

		try {
			// The thumbnail: 250 px wide, the height following the aspect ratio, in the screenshot's own format,
			// oriented as the image displays — sharp (libvips) on its own thread pool, Jimp only for a format libvips
			// does not decode (BMP). Jimp did every one in JavaScript on the event loop: a full-resolution screenshot
			// per upload, from every tracker every few minutes, and every other request of the API waited for it.
			const { data, extension } = await createImageThumbnail(fileContent);

			// Define thumbnail file name and directory
			// Named for what the bytes are, not for the client-supplied extension of the upload
			const thumbName = thumbnailFileName(file.filename, extension);
			const thumbDir = path.dirname(file.key);

			// Replace double backslashes with single forward slashes
			const fullPath = path.join(thumbDir, thumbName).replace(/\\/g, '/');

			// Upload the thumbnail data to the file storage provider
			const thumb = await provider.putFile(data, fullPath);
			if (this.logging) this.logger.log('Screenshot thumb created');

			// Populate entity properties for the screenshot
			const entity = new Screenshot({
				organizationId,
				tenantId,
				userId,
				file: file.key,
				thumb: thumb.key,
				storageProvider: provider.name.toUpperCase(),
				timeSlotId: isUUID(input.timeSlotId) ? input.timeSlotId : null,
				recordedAt: input.recordedAt ? input.recordedAt : new Date()
			});

			// Create the screenshot entity in the database
			const screenshot = await this._screenshotService.create(entity);
			if (this.logging) this.logger.log(`Screenshot created for employee`);

			// Publish the screenshot created event
			const ctx = RequestContext.currentRequestContext(); // Get current request context;
			const event = new ScreenshotEvent(ctx, screenshot, BaseEntityEventTypeEnum.CREATED, input, data, file);
			this._eventBus.publish(event); // Publish the event using EventBus

			// Find screenshot by ID
			return await this._screenshotService.findOneByIdString(screenshot.id);
		} catch (error) {
			this.logger.error(`Error while creating screenshot: ${error?.message ?? error}`, error?.stack);
		}
	}

	/**
	 * Deletes a screenshot record by its ID.
	 *
	 * This endpoint allows authorized users to delete a screenshot record by providing its ID.
	 * Additional query options can be provided to customize the delete operation.
	 *
	 * @param id - The UUID of the screenshot to delete.
	 * @param options - Additional query options for deletion (e.g., soft delete or force delete).
	 * @returns A Promise that resolves with the details of the deleted screenshot.
	 */
	@ApiOperation({
		summary: 'Delete a screenshot by ID',
		description: 'Deletes a screenshot record from the system based on the provided ID.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The screenshot has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Screenshot record not found.'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to delete screenshots.'
	})
	@Permissions(PermissionsEnum.DELETE_SCREENSHOTS)
	@Delete(':id')
	@UseValidationPipe()
	async delete(@Param('id', UUIDValidationPipe) id: ID, @Query() options: DeleteScreenshotDTO): Promise<IScreenshot> {
		return await this._screenshotService.deleteScreenshot(id, options);
	}
}
