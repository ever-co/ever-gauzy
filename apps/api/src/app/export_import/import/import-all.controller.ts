import {
	Controller,
	HttpStatus,
	Get,
	Post,
	UseInterceptors,
	Injectable,
	Body,
	UploadedFile
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OnDestroy } from '@angular/core';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportAllService } from '.';
import * as path from 'path';
import { FileStorage } from '../../core/file-storage';

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
		FileInterceptor('file', {
			storage: new FileStorage().storage({
				dest: path.join('import'),
				prefix: 'import'
			})
		})
	)
	@Post()
	async parse(@Body() { importType }, @UploadedFile() file) {
		this.importAllService.removeExtractedFiles();
		await this.importAllService.unzipAndParse(
			file.key,
			importType === 'clean'
		);

		return;
	}

	ngOnDestroy() {}
}
