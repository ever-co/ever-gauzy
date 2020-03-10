import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
//import UUID from 'pure-uuid';
import { Subject } from 'rxjs';

@Injectable()
export class ExportAllService {
	fileName = new Subject<string>();
	async archiveAndDownload() {
		fs.mkdir('./export', { recursive: true }, (err) => {
			if (err) throw err;
		});

		//const id = new UUID(4).format();
		const id = uuidv4();

		const fileNameS = id + '_export.zip';
		this.fileName.next(fileNameS);
		const output = fs.createWriteStream(`./export/${fileNameS}`);
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

		archive.directory('./apps/api/src/app/export_import/all-data/', false);

		archive.finalize();
	}
}
