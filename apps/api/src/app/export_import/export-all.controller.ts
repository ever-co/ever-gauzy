import { Controller, HttpStatus, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExportAllService } from './export-all.service';
import { OnDestroy } from '@angular/core';
import * as fs from 'fs-extra';
import { Subscription } from 'rxjs';

@ApiTags('Download')
@Controller()
export class ExportAllController implements OnDestroy {
	private sub: Subscription;
	constructor(private readonly downloadAllService: ExportAllService) {}

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
	async downloadAll(@Res() res) {
		let fileName = '';
		this.sub = this.downloadAllService.fileName.subscribe((filename) => {
			fileName = filename;
		});
		this.downloadAllService.archiveAndDownload();

		setTimeout(function() {
			res.download(`./export/${fileName}`);
		}, 2000);
		await setTimeout(function() {
			fs.removeSync(`./export/${fileName}`);
		}, 5000);
	}
	ngOnDestroy() {
		this.sub.unsubscribe();
	}
}
