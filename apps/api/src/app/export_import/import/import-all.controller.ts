import {
	Controller,
	HttpStatus,
	Get,
	Post,
	UseInterceptors,
	Injectable,
	Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OnDestroy } from '@angular/core';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ImportAllService } from '.';
import * as path from 'path';

@Injectable()
@ApiTags('Import')
@Controller()
export class ImportAllController implements OnDestroy {
	constructor(private importAllService: ImportAllService) {}

	@ApiOperation({ summary: 'Find all exports.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async importAll() {}

	@UseInterceptors(
		FilesInterceptor('file', 1, {
			storage: diskStorage({
				destination: path.join(__dirname, '../../import'),
				filename: (rq, file, cb) => {
					cb(null, 'import.zip');
				}
			})
		})
	)
	@Post()
	async parse(@Body() { importType }) {
		this.importAllService.removeExtractedFiles();

		this.importAllService.unzipAndParse(importType === 'clean');

		return;
	}

	ngOnDestroy() {}
}
