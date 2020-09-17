import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	UseInterceptors
} from '@nestjs/common';
import { Screenshot } from '../screenshot.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { ScreenshotService } from './screenshot.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as moment from 'moment';
import * as sharp from 'sharp';
import { FileStorage } from '../../core/file-storage';
import { UploadedFileStorage } from '../../core/file-storage/uploaded-file-storage';
import * as Jimp from 'jimp';
import * as os from 'os';
import * as fs from 'fs';

@ApiTags('Screenshot')
@UseGuards(AuthGuard('jwt'))
@Controller('screenshot')
export class ScreenshotController extends CrudController<Screenshot> {
	constructor(private readonly screenshotService: ScreenshotService) {
		super(screenshotService);
	}

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
	@Post('/')
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
	async upload(
		@Body() entity: Screenshot,
		@UploadedFileStorage()
		file
	): Promise<Screenshot> {
		let thumb;
		try {
			const fileContent = await new FileStorage()
				.getProvider()
				.getFile(file.key);

			const tempPath = path.join(os.tmpdir(), 'screenshot-thumb-');
			const folder = await fs.promises.mkdtemp(tempPath);
			const file_name = path.join(
				folder,
				'screenshot-' + moment().unix()
			);
			await fs.promises.writeFile(file_name, fileContent);

			console.log(file_name);
			const data = await sharp(file_name)
				.resize(250, 150)
				.toBuffer({ resolveWithObject: true });

			await fs.promises.unlink(file_name);

			const thumbName = `thumb-${file.filename}`;
			const thumbDir = path.dirname(file.key);
			thumb = await new FileStorage()
				.getProvider()
				.putFile(
					data.toString('utf-8'),
					path.join(thumbDir, thumbName)
				);
			console.log({ thumb });
		} catch (error) {
			console.log(error);
		}

		entity.file = file.key;
		entity.thumb = thumb.key;
		entity.recordedAt = entity.recordedAt ? entity.recordedAt : new Date();
		const screenshot = await this.screenshotService.create(entity);

		return this.screenshotService.findOne(screenshot.id);
	}
}
