import { Injectable } from '@nestjs/common';
import { OnDestroy } from '@angular/core';
import * as fs from 'fs';
import * as unzipper from 'unzipper';

@Injectable()
export class ImportAllService implements OnDestroy {
	async unzip(): Promise<any> {
		return new Promise(async (resolve, reject) => {
			fs.createReadStream('./import/export.zip').pipe(
				unzipper.Extract({ path: './import/test' })
			);
			resolve();
		});
	}

	async createFolder(): Promise<any> {
		return new Promise((resolve, reject) => {
			fs.access(`./import`, (error) => {
				if (!error) {
					return null;
				} else {
					fs.mkdir(`./import`, { recursive: true }, (err) => {
						if (err) reject(err);
						resolve();
					});
				}
			});
		});
	}
	ngOnDestroy() {}
}
