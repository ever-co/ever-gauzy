import { Injectable, HttpService } from '@nestjs/common';
import * as fs from 'fs';
import * as archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { Subject } from 'rxjs';
import { env } from '../../../../../../gauzy/.scripts/env';

@Injectable()
export class ExportAllService {
	fileName = new Subject<string>();
	constructor(private httpService: HttpService) {}
	async archiveAndDownload() {
		fs.access('./export', (error) => {
			if (!error) {
				return null;
			} else {
				fs.mkdir('./export', { recursive: true }, (err) => {
					if (err) throw err;
				});
			}
		});
		fs.access('./export/csv', (error) => {
			if (!error) {
				return null;
			} else {
				fs.mkdir('./export/csv', { recursive: true }, (err) => {
					if (err) throw err;
				});
			}
		});

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

		archive.directory('./export/csv', false);

		archive.finalize();
	}
	downloadAllCountries() {
		return this.httpService.get(env.API_BASE_URL + '/api/country');
	}
}
