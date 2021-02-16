import {
	Controller,
	HttpStatus,
	Get,
	Res,
	UseGuards,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExportAllService } from './export-all.service';
import { AuthGuard } from '@nestjs/passport';
import { ParseJsonPipe } from './../shared/pipes/parse-json.pipe';

@ApiTags('Download')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ExportAllController {
	constructor(private readonly exportService: ExportAllService) {}

	@ApiTags('Download')
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
	async exportAll(@Query('data', ParseJsonPipe) data: any, @Res() res) {
		const { findInput = null } = data;
		await this.exportService.createFolders();
		await this.exportService.exportTables(findInput);
		await this.exportService.archiveAndDownload();
		await this.exportService.downloadToUser(res);
		await this.exportService.deleteCsvFiles();
		this.exportService.deleteArchive();
	}
	@Get('template')
	async downloadTemplate(@Res() res) {
		await this.exportService.downloadTemplate(res);
	}

	@ApiOperation({ summary: 'Find exports by name' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found specific tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('filter')
	async exportByName(@Query('data') data: string, @Res() res): Promise<any> {
		const {
			entities: { names },
			findInput = null
		} = JSON.parse(data);

		await this.exportService.createFolders();
		await this.exportService.exportSpecificTables(names, findInput);
		await this.exportService.archiveAndDownload();
		await this.exportService.downloadToUser(res);
		await this.exportService.deleteCsvFiles();
		this.exportService.deleteArchive();
	}
}
