import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	UseInterceptors,
	Delete,
	Param,
	ExecutionContext,
	Query,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as path from 'path';
import * as moment from 'moment';
import * as sharp from 'sharp';
import * as fs from 'fs';
import { FileStorageProviderEnum, IScreenshot, PermissionsEnum } from '@gauzy/contracts';
import { Screenshot } from './screenshot.entity';
import { ScreenshotService } from './screenshot.service';
import { RequestContext } from './../../core/context';
import { FileStorage, UploadedFileStorage } from '../../core/file-storage';
import { tempFile } from '../../core/utils';
import { LazyFileInterceptor } from './../../core/interceptors';
import { Permissions } from './../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { DeleteQueryDTO } from './dto';

@ApiTags('Screenshot')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER)
@Controller()
export class ScreenshotController {
	constructor(
		private readonly screenshotService: ScreenshotService
	) {}

	@ApiOperation({ summary: 'Add manual time' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timer has been successfully On/Off.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UseInterceptors(
        LazyFileInterceptor('file', {
			storage: (request: ExecutionContext) => {
                return new FileStorage().storage({
					dest: () => {
						return path.join(
							'screenshots',
							moment().format('YYYY/MM/DD')
						);
					},
                  	prefix: 'screenshots'
              	})
            }
        })
    )
	async create(
		@Body() entity: Screenshot,
		@UploadedFileStorage() file
	) {
		console.log('Screenshot Http Request', {
			entity
		});
		const user = RequestContext.currentUser();
		const provider = new FileStorage().getProvider();
		let thumb;
		try {
			const fileContent = await provider.getFile(file.key);
			const inputFile = await tempFile('screenshot-thumb');
			const outputFile = await tempFile('screenshot-thumb');
			await fs.promises.writeFile(inputFile, fileContent);
			await new Promise((resolve, reject) => {
				sharp(inputFile)
					.resize(250, 150)
					.toFile(outputFile, (error: any, data: any) => {
						if (error) {
							reject(error);
						} else {
							resolve(data);
						}
					});
			});
			const thumbName = `thumb-${file.filename}`;
			const thumbDir = path.dirname(file.key);
			const data = await fs.promises.readFile(outputFile);
			await fs.promises.unlink(inputFile);
			await fs.promises.unlink(outputFile);

			thumb = await provider.putFile(data, path.join(thumbDir, thumbName));
			console.log(`Screenshot thumb created for employee (${user.name})`, thumb);
		} catch (error) {
			console.log('Error while uploading screenshot into file storage provider:', error);
		}

		try {
			entity.file = file.key;
			entity.thumb = thumb.key;
			entity.storageProvider = (provider.name).toUpperCase() as FileStorageProviderEnum;
			entity.recordedAt = entity.recordedAt ? entity.recordedAt : new Date();

			const screenshot = await this.screenshotService.create(entity);
			console.log(`Screenshot created for employee (${user.name})`, screenshot);
			return this.screenshotService.findOneByIdString(screenshot.id);
		} catch (error) {
			console.log(`Error while creating screenshot for employee (${user.name})`, error);
		}
	}

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
