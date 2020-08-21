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

export interface FileSystem {
	rootPath: string;
	baseUrl: string;
}

/*
 * How to Use
 *
 * 	FilesInterceptor('file', 1, {
 * 		storage: new FileStorage({
 * 			dest: path.join('import', moment().format('YYYY/MM/DD')), // moment is use to create year, month and day dir, If you don't want you can skip it.
 * 			prefix: 'import'
 * 		})
 * 	})
 */

export class FileStorage {
	static defaultFileSystem = 'local';

	static fileSystems: { [key: string]: FileSystem } = {
		local: {
			rootPath: path.join(process.cwd(), 'apps', 'api', 'public'),
			baseUrl: environment.baseUrl + '/public'
		}
	};

	constructor(option: FileStorageOption) {
		return FileStorage.default(option);
	}

	static default(option: FileStorageOption) {
		return FileStorage[this.defaultFileSystem](option);
	}

	static url(filePath: string) {
		if (filePath && filePath.startsWith('http')) {
			return filePath;
		}
		const fileSytem =
			FileStorage.fileSystems[FileStorage.defaultFileSystem];
		return filePath ? fileSytem.baseUrl + '/' + filePath : null;
	}

	static path(filePath: string) {
		const fileSytem =
			FileStorage.fileSystems[FileStorage.defaultFileSystem];
		return filePath ? fileSytem.rootPath + '/' + filePath : null;
	}

	static local({ dest, filename, prefix }: FileStorageOption) {
		return multer.diskStorage({
			destination: (req, file, callback) => {
				const fileSytem = FileStorage.fileSystems.local;
				fs.mkdirSync(path.join(fileSytem.rootPath, dest), {
					recursive: true
				});
				callback(null, path.join(fileSytem.rootPath, dest));
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
