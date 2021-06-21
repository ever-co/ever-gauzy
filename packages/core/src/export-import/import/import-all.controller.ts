import {
	Controller,
	HttpStatus,
	Get,
	Post,
	UseInterceptors,
	Body,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import { AuthGuard } from '@nestjs/passport';
import { ImportAllService } from './import-all.service';
import { FileStorage, UploadedFileStorage } from '../../core/file-storage';

@ApiTags('Import')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ImportAllController {
	constructor(
		private readonly importAllService: ImportAllService
	) {}

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
		try {
			await this.importAllService.unzipAndParse(
				file.key,
				importType === 'clean'
			);
			this.importAllService.removeExtractedFiles();
			return true;
		} catch (error) {
			return false;
		}
	}
}
