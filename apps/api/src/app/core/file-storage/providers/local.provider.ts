import { FileStorageOption, UploadedFile } from '../models';
import * as multer from 'multer';
import * as fs from 'fs';
import * as moment from 'moment';
import { environment } from '@env-api/environment';
import { Provider } from './provider';
import { join, resolve } from 'path';

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

	async getFile(file: string): Promise<string> {
		const buffer = fs.readFileSync(this.path(file), { encoding: 'utf8' });
		const content = buffer.toString();
		return await content;
	}

	async putFile(fileContent: string, path: string = ''): Promise<any> {
		console.log('putFile');
		return new Promise((resolve, reject) => {
			fs.writeFile(path, fileContent, (err, data) => {
				console.log('putFile', err, data);
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			});
		});
	}

	mapUploadedFile(file): UploadedFile {
		if (file.path) {
			file.key = file.path.replace(this.config.rootPath, '');
		}
		return file;
	}
}
