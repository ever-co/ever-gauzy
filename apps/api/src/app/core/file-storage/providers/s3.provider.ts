import { FileStorageOption, FileSystemProvider } from '../models';
import * as multerS3 from 'multer-s3';
import { join, resolve } from 'path';
import * as moment from 'moment';
import { environment } from '@env-api/environment';
import * as AWS from 'aws-sdk';
import { StorageEngine } from 'multer';

export class S3Provider implements FileSystemProvider {
	static instance: S3Provider;

	name = 's3';
	tenantId: string;

	config = {
		rootPath: environment.isElectron
			? resolve(environment.gauzyUserPath, 'public')
			: resolve(process.cwd(), 'apps', 'api', 'public'),
		baseUrl: environment.baseUrl + '/public'
	};

	constructor() {}

	getInstance() {
		if (!S3Provider.instance) {
			S3Provider.instance = new S3Provider();
		}
		return S3Provider.instance;
	}

	url(filePath: string) {
		if (filePath && filePath.startsWith('http')) {
			return filePath;
		}
		return filePath ? this.config.baseUrl + '/' + filePath : null;
	}

	path(filePath: string) {
		return filePath ? this.config.rootPath + '/' + filePath : null;
	}

	handler({ dest, filename, prefix }: FileStorageOption): StorageEngine {
		AWS.config.update({ region: environment.awsConfig.region });

		return multerS3({
			s3: new AWS.S3({
				accessKeyId: environment.awsConfig.accessKeyId,
				secretAccessKey: environment.awsConfig.secretAccessKey
			}),
			bucket: environment.awsConfig.s3.bucket,
			metadata: function (_req, file, cb) {
				cb(null, { fieldName: file.fieldname });
			},
			key: (_req, file, callback) => {
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
				let dir;
				if (dest instanceof Function) {
					dir = dest(file);
				} else {
					dir = dest;
				}
				callback(null, join(dir, fileNameString));
			}
		});
	}
}
