import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { BehaviorSubject, Subject } from 'rxjs';
import { CountryService } from '../country';
import * as csv from 'csv-writer';
import { UserService } from '../user';
import { OnDestroy } from '@angular/core';
import { takeUntil } from 'rxjs/operators';

@Injectable()
export class ExportAllService implements OnDestroy {
	public idZip = new BehaviorSubject<string>('');
	public idCsv = new BehaviorSubject<string>('');
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private countryService: CountryService,
		private userService: UserService
	) {}

	async createFolders(): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = uuidv4();
			this.idCsv.next(id);
			fs.access(`./export/${id}/csv`, (error) => {
				if (!error) {
					return null;
				} else {
					fs.mkdir(
						`./export/${id}/csv`,
						{ recursive: true },
						(err) => {
							if (err) reject(err);
							resolve();
						}
					);
				}
			});
		});
	}

	async archiveAndDownload(): Promise<any> {
		return new Promise((resolve, reject) => {
			{
				const id = uuidv4();
				const fileNameS = id + '_export.zip';
				this.idZip.next(fileNameS);

				const output = fs.createWriteStream(`./export/${fileNameS}`);

				const archive = archiver('zip', {
					zlib: { level: 9 }
				});

				output.on('close', function() {
					resolve();
				});

				output.on('end', function() {
					console.log('Data has been drained');
				});

				archive.on('warning', function(err) {
					if (err.code === 'ENOENT') {
						reject(err);
					} else {
						console.log('Unexpected error!');
					}
				});

				archive.on('error', function(err) {
					reject(err);
				});

				let id$ = '';
				this.idCsv
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((idCsv) => {
						id$ = idCsv;
					});

				archive.pipe(output);
				archive.directory(`./export/${id$}/csv`, false);
				archive.finalize();
			}
		});
	}

	async getAsCsv(): Promise<any> {
		const incommingData = (await this.countryService.findAll()).items;
		return new Promise((resolve, reject) => {
			const createCsvWriter = csv.createObjectCsvWriter;
			const dataIn = [];

			const dataKeys = Object.keys(incommingData[0]);

			for (const count of dataKeys) {
				dataIn.push({ id: count, title: count });
			}
			let id$ = '';
			this.idCsv.pipe(takeUntil(this._ngDestroy$)).subscribe((id) => {
				id$ = id;
			});
			const csvWriter = createCsvWriter({
				path: `./export/${id$}/csv/countries.csv`,
				header: dataIn
			});

			const data = incommingData;

			csvWriter.writeRecords(data).then(() => {
				resolve();
			});
		});
	}

	async downloadToUser(res): Promise<any> {
		return new Promise((resolve, reject) => {
			let fileName = '';

			this.idZip
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((filename) => {
					fileName = filename;
				});
			res.download(`./export/${fileName}`);

			resolve();
		});
	}

	async deleteCsvFiles(): Promise<any> {
		return new Promise((resolve, reject) => {
			let id$ = '';

			this.idCsv.pipe(takeUntil(this._ngDestroy$)).subscribe((id) => {
				id$ = id;
			});

			fs.access(`./export/${id$}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${id$}`);
					resolve();
				} else {
					return null;
				}
			});
		});
	}
	async deleteArchive(): Promise<any> {
		return new Promise((resolve, reject) => {
			let fileName = '';
			this.idZip
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((fileName$) => {
					fileName = fileName$;
				});

			fs.access(`./export/${fileName}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${fileName}`);
					resolve();
				} else {
					return null;
				}
			});
		});
	}

	async exportCountries() {
		return await this.getAsCsv();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
