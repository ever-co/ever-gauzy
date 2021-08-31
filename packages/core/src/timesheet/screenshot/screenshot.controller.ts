import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	UseInterceptors
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as moment from 'moment';
import * as sharp from 'sharp';
import * as fs from 'fs';
import { IScreenshot } from '@gauzy/contracts';
import { Screenshot } from './screenshot.entity';
import { ScreenshotService } from './screenshot.service';
import { FileStorage, UploadedFileStorage } from '../../core/file-storage';
import { tempFile } from '../../core/utils';
import { TenantPermissionGuard } from './../../shared/guards';

@ApiTags('Screenshot')
@UseGuards(TenantPermissionGuard)
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
		FileInterceptor('file', {
			storage: new FileStorage().storage({
				dest: () => {
					return path.join(
						'screenshots',
						moment().format('YYYY/MM/DD')
					);
				},
				prefix: 'screenshots'
			})
		})
	)
	async create(
		@Body() entity: Screenshot,
		@UploadedFileStorage()
		file
	): Promise<IScreenshot> {
		let thumb;
		try {
			const fileContent = await new FileStorage()
				.getProvider()
				.getFile(file.key);

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

			thumb = await new FileStorage()
				.getProvider()
				.putFile(data, path.join(thumbDir, thumbName));
		} catch (error) {
			console.log(error);
		}

		entity.file = file.key;
		entity.thumb = thumb.key;
		entity.recordedAt = entity.recordedAt ? entity.recordedAt : new Date();

		const screenshot = await this.screenshotService.create(entity);
		console.log(`Screenshot Created API:`, screenshot);

		return this.screenshotService.findOne(screenshot.id);
	}
}
