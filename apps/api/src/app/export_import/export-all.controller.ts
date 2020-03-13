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
	constructor(private readonly exportService: ExportAllService) {}

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
	async exportAll(@Res() res) {
		let fileName = '';

		this.sub = this.exportService.fileName.subscribe((filename) => {
			fileName = filename;
		});

		await this.exportService.exportAllCountries().subscribe(() => {
			return null;
		});

		await this.exportService.exportAllCountries().toPromise();
		this.exportService.archiveAndDownload();

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
