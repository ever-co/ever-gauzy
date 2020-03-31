import { Controller, HttpStatus, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExportAllService } from './export-all.service';
import { OnDestroy } from '@angular/core';

@ApiTags('Download')
@Controller()
export class ExportAllController implements OnDestroy {
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
	async exportAll(@Res() res) {
		await this.exportService.createFolders();
		await this.exportService.exportTables();
		await this.exportService.archiveAndDownload();
		await this.exportService.downloadToUser(res);
		await this.exportService.deleteCsvFiles();
		this.exportService.deleteArchive();
	}

	ngOnDestroy() {}
}
