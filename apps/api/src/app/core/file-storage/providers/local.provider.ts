import { FileStorageOption, UploadedFile } from '../models';
import * as multer from 'multer';
import * as fs from 'fs';
import * as moment from 'moment';
import { environment } from '@env-api/environment';
import { Provider } from './provider';
import { basename, dirname, join, resolve } from 'path';

export class LocalProvider extends Provider {
	static instance: LocalProvider;
	name = 'local';
	tenantId = '';
	config = {
		rootPath: environment.isElectron
			? resolve(environment.gauzyUserPath, 'public')
			: resolve(process.cwd(), 'apps', 'api', 'public'),
		baseUrl: environment.baseUrl + '/public'
	};

	getInstance() {
		if (!LocalProvider.instance) {
			LocalProvider.instance = new LocalProvider();
		}
		return LocalProvider.instance;
	}

	url(filePath: string) {
		if (filePath && filePath.startsWith('http')) {
			return filePath;
		}
		return filePath ? `${this.config.baseUrl}/${filePath}` : null;
	}

	path(filePath: string) {
		return filePath ? `${this.config.rootPath}/${filePath}` : null;
	}

	handler({
		dest,
		filename,
		prefix
	}: FileStorageOption): multer.StorageEngine {
		return multer.diskStorage({
			destination: (_req, file, callback) => {
				let dir;
				if (dest instanceof Function) {
					dir = dest(file);
				} else {
					dir = dest;
				}

				fs.mkdirSync(join(this.config.rootPath, this.tenantId, dir), {
					recursive: true
				});

				callback(null, join(this.config.rootPath, this.tenantId, dir));
			},
			filename: (_req, file, callback) => {
				let fileNameString = '';
				const ext = file.originalname.split('.').pop();
				if (filename) {
					if (typeof filename === 'string') {
						fileNameString = filename;
					} else {
						fileNameString = filename(file, ext);
					}
				} else {
					fileNameString = `${prefix}-${moment().unix()}-${parseInt(
						'' + Math.random() * 1000,
						10
					)}.${ext}`;
				}
				callback(null, fileNameString);
			}
		});
	}

	async getFile(file: string, buffer = false): Promise<any> {
		const bufferData = await fs.promises.readFile(this.path(file), 'utf-8');
		console.log('getFile', bufferData);
		if (buffer) {
			return bufferData;
		} else {
			return bufferData.toString();
		}
	}

	async putFile(fileContent: string, path: string = ''): Promise<any> {
		return new Promise((resolve, reject) => {
			const fullPath = join(this.config.rootPath, path);
			fs.writeFile(fullPath, fileContent, (err, data) => {
				const stats = fs.statSync(fullPath);
				const baseName = basename(path);

				const file = {
					originalname: baseName, // orignal file name
					size: stats.size, // files in bytes
					filename: baseName,
					path: fullPath // Full path of the file
				};
				if (err) {
					reject(err);
				} else {
					resolve(this.mapUploadedFile(file));
				}
			});
		});
	}

	mapUploadedFile(file): UploadedFile {
		if (file.path) {
			file.key = file.path.replace(this.config.rootPath + '/', '');
		}
		file.url = this.url(file.key);
		return file;
	}
}
