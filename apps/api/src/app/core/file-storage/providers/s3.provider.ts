import { FileStorageOption, UploadedFile } from '../models';
import * as multerS3 from 'multer-s3';
import { join, resolve } from 'path';
import * as moment from 'moment';
import { environment } from '@env-api/environment';
import * as AWS from 'aws-sdk';
import { StorageEngine } from 'multer';
import { Provider } from './provider';

export class S3Provider extends Provider {
	static instance: S3Provider;

	name = 's3';
	tenantId: string;

	config = {
		rootPath: environment.isElectron
			? resolve(environment.gauzyUserPath, 'public')
			: resolve(process.cwd(), 'apps', 'api', 'public'),
		baseUrl: environment.baseUrl + '/public'
	};

	getInstance() {
		if (!S3Provider.instance) {
			S3Provider.instance = new S3Provider();
		}
		return S3Provider.instance;
	}

	getS3Bucket() {
		return environment.awsConfig.s3.bucket;
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
			s3: this.getS3Instance(),
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

	async getFile(file: string, buffer = false): Promise<any> {
		const s3 = this.getS3Instance();
		const params = {
			Bucket: this.getS3Bucket(),
			Key: file
		};
		const data = await s3.getObject(params).promise();
		if (buffer) {
			return data.Body;
		} else {
			return data.Body.toString('utf-8');
		}
	}

	async putFile(fileContent: string, path: string = ''): Promise<any> {
		console.log('putFile s3');
		return new Promise((resolve, reject) => {
			const s3 = this.getS3Instance();
			const params = {
				Bucket: this.getS3Bucket(),
				Body: fileContent,
				Key: path
			};
			s3.putObject(params, (err, data: AWS.S3.PutObjectOutput) => {
				console.log('putFile', err, data);
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			});
		});
	}

	private getS3Instance() {
		return new AWS.S3({
			accessKeyId: environment.awsConfig.accessKeyId,
			secretAccessKey: environment.awsConfig.secretAccessKey
		});
	}

	mapUploadedFile(file): UploadedFile {
		file.filename = file.originalname;
		return file;
	}
}
