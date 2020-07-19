import * as path from 'path';
import * as moment from 'moment';
import * as fs from 'fs';
import * as multer from 'multer';
import { environment } from '@env-api/environment';

export interface FileStorageOption {
	dest: string;
	prefix?: string;
	filename?: string | CallableFunction;
}

export class FileStorage {
	static rootPath = path.join(process.cwd(), 'apps', 'api');

	static default(option: FileStorageOption) {
		return FileStorage.local(option);
	}

	static url(filePath: string) {
		if (filePath && filePath.startsWith('http')) {
			return filePath;
		}
		return filePath ? environment.baseUrl + '/' + filePath : null;
	}

	static local({ dest, filename, prefix }: FileStorageOption) {
		return multer.diskStorage({
			destination: (req, file, callback) => {
				fs.mkdirSync(path.join(FileStorage.rootPath, dest), {
					recursive: true
				});
				callback(null, path.join(FileStorage.rootPath, dest));
			},
			filename: (req, file, callback) => {
				let fileNameString = '';
				const ext = file.originalname.split('.').pop();
				if (filename) {
					if (typeof filename === 'string') {
						fileNameString = filename;
					} else {
						fileNameString = filename(file, ext);
					}
				} else {
					fileNameString = `gauzy-${prefix}-${moment().unix()}-${parseInt(
						'' + Math.random() * 1000,
						10
					)}.${ext}`;
				}
				callback(null, fileNameString);
			}
		});
	}
}
