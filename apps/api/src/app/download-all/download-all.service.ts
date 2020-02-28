import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as archiver from 'archiver';

@Injectable()
export class DownloadAllService {
	async archiveAndDownload() {
		const output = fs.createWriteStream(
			'C:/Coding/gauzy/apps/api/src/app/download-all' +
				'/alldata/export.zip'
		);
		const archive = archiver('zip', {
			zlib: { level: 9 }
		});

		output.on('close', function() {
			console.log(archive.pointer() + ' total bytes');
			console.log(
				'archiver has been finalized and the output file descriptor has closed.'
			);
		});

		output.on('end', function() {
			console.log('Data has been drained');
		});

		archive.on('warning', function(err) {
			if (err.code === 'ENOENT') {
				console.log('error');
			} else {
				throw err;
			}
		});

		archive.on('error', function(err) {
			throw err;
		});

		archive.pipe(output);

		archive.directory(
			'C:/Coding/gauzy/apps/api/src/app/download-all/' +
				'downloaded-data/',
			false
		);

		archive.finalize();
	}
}
