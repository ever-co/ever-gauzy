import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { Subject } from 'rxjs';
import { CountryService } from '../country';
import * as csv from 'csv-writer';
import { UserService } from '../user';

@Injectable()
export class ExportAllService {
	fileName = new Subject<string>();

	constructor(
		private countryService: CountryService,
		private userService: UserService
	) {}

	async archiveAndDownload(): Promise<any> {
		return new Promise((resolve, reject) => {
			{
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
					resolve();
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
		});
	}

	async getAsCsv() {
		await fs.access('./export/csv', (error) => {
			if (!error) {
				return null;
			} else {
				fs.mkdir('./export/csv', { recursive: true }, (err) => {
					if (err) throw err;
				});
			}
		});

		const createCsvWriter = csv.createObjectCsvWriter;
		const dataIn = [];
		const incommingData = (await this.countryService.findAll()).items;
		const dataKeys = Object.keys(incommingData[0]);

		for (const count of dataKeys) {
			dataIn.push({ id: count, title: count });
		}

		const csvWriter = createCsvWriter({
			path: './export/csv/country.csv',
			header: dataIn
		});

		const data = incommingData;

		csvWriter
			.writeRecords(data)
			.then(() => console.log('The CSV file was written successfully'));
	}

	exportAllCountries() {
		return this.getAsCsv();
	}
}
