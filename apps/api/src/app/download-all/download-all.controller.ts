import { Controller, HttpStatus, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DownloadAllService } from './download-all.service';

@ApiTags('Download')
@Controller()
export class DownloadAllController {
	constructor(private readonly downloadAllService: DownloadAllService) {}

	@ApiTags('Download')
	@ApiOperation({ summary: 'Find all employees.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async downloadAll() {
		this.downloadAllService.archiveAndDownload();
	}
}
