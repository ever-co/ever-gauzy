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
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import { ImportAllService } from './import-all.service';
import { FileStorage } from '../../core/file-storage';
import { UploadedFileStorage } from 'core/file-storage/uploaded-file-storage';

@Injectable()
@ApiTags('Import')
@Controller()
export class ImportAllController {
	constructor(private importAllService: ImportAllService) {}

	@ApiOperation({ summary: 'Find all imports.' })
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
	@ApiOperation({ summary: 'Imports templates records.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post()
	async parse(@Body() { importType }, @UploadedFileStorage() file) {
		this.importAllService.removeExtractedFiles();
		await this.importAllService.unzipAndParse(
			file.key,
			importType === 'clean'
		);

		return;
	}
}
