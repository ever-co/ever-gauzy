import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	UseInterceptors,
	UploadedFile
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
			storage: FileStorage.default({
				dest: path.join(
					'public',
					'screenshots',
					moment().format('YYYY/MM/DD')
				),
				prefix: 'screenshots'
			})
		})
	)
	async upload(
		@Body() entity: Screenshot,
		@UploadedFile() file
	): Promise<Screenshot> {
		const thumbName = `thumb-${file.filename}`;
		await new Promise((resolve, reject) => {
			sharp(file.path)
				.resize(250, 150)
				.toFile(path.join(file.destination, thumbName), (err, info) => {
					if (err) {
						reject(err);
						return;
					}
					resolve(info);
				});
		});
		entity.file = path.join(
			'public',
			'screenshots',
			moment().format('YYYY/MM/DD'),
			file.filename
		);
		entity.thumb = path.join(
			'public',
			'screenshots',
			moment().format('YYYY/MM/DD'),
			thumbName
		);
		entity.recordedAt = entity.recordedAt ? entity.recordedAt : new Date();

		const screenshot = await this.screenshotService.create(entity);
		return this.screenshotService.findOne(screenshot.id);
	}
}
