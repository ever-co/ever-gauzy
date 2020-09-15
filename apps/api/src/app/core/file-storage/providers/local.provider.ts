import { FileStorageOption, FileSystemProvider } from '../models';
import * as multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as moment from 'moment';
import { environment } from '@env-api/environment';

export class LocalProvider implements FileSystemProvider {
	static instance: LocalProvider;
	name = 'local';
	tenantId = '';
	config = {
		rootPath: environment.isElectron
			? path.resolve(environment.gauzyUserPath, 'public')
			: path.resolve(process.cwd(), 'apps', 'api', 'public'),
		baseUrl: environment.baseUrl + '/public'
	};
	constructor() {}

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

				fs.mkdirSync(
					path.join(this.config.rootPath, this.tenantId, dir),
					{
						recursive: true
					}
				);

				callback(
					null,
					path.join(this.config.rootPath, this.tenantId, dir)
				);
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
}
