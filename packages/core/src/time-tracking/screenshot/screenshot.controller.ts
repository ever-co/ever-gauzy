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
	ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as path from 'path';
import * as moment from 'moment';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';
import * as Jimp from 'jimp';
import {
	FileStorageProviderEnum,
	IScreenshot,
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

@ApiTags('Screenshot')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller()
export class ScreenshotController {

	constructor(
		private readonly screenshotService: ScreenshotService
	) { }

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
		LazyFileInterceptor('file', {
			storage: () => {
				return new FileStorage().storage({
					dest: () => path.join('screenshots', moment().format('YYYY/MM/DD'), RequestContext.currentTenantId() || uuid()),
					prefix: 'screenshots',
				});
			},
		})
	)
	async create(
		@Body() entity: Screenshot,
		@UploadedFileStorage() file: UploadedFile
	) {
		console.log('Screenshot Http Request', { entity, file });
		const user = RequestContext.currentUser();
		const provider = new FileStorage().getProvider();
		let thumb: UploadedFile;

		try {
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
			const data = await fs.promises.readFile(outputFile);
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
			entity.userId = RequestContext.currentUserId();
			entity.file = file.key;
			entity.thumb = thumb.key;
			entity.storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;
			entity.recordedAt = entity.recordedAt ? entity.recordedAt : new Date();

			const screenshot = await this.screenshotService.create(entity);
			console.log(`Screenshot created for employee (${user.name})`, screenshot);
			return await this.screenshotService.findOneByIdString(screenshot.id);
		} catch (error) {
			console.log(`Error while creating screenshot for employee (${user.name})`, error);
		}
	}

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
		return await this.screenshotService.deleteScreenshot(
			screenshotId,
			options
		);
	}
}
