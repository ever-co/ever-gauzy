import { FileStorageOption, UploadedFile } from '../models';
import * as multerS3 from 'multer-s3';
import { basename, join } from 'path';
import * as moment from 'moment';
import { environment } from '@env-api/environment';
import * as AWS from 'aws-sdk';
import { StorageEngine } from 'multer';
import { Provider } from './provider';
import { RequestContext } from '../../context';

export class S3Provider extends Provider<S3Provider> {
	static instance: S3Provider;

	name = 's3';
	tenantId: string;

	config = {
		rootPath: ''
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

	url(key: string) {
		const url = this.getS3Instance().getSignedUrl('getObject', {
			Bucket: this.getS3Bucket(),
			Key: key,
			Expires: 3600
		});
		return url;
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
				const user = RequestContext.currentUser();
				callback(
					null,
					join(
						this.config.rootPath,
						user ? user.tenantId : '',
						dir,
						fileNameString
					)
				);
			}
		});
	}

	async getFile(key: string): Promise<Buffer> {
		const s3 = this.getS3Instance();
		const params = {
			Bucket: this.getS3Bucket(),
			Key: key
		};
		const data = await s3.getObject(params).promise();
		return data.Body as Buffer;
	}

	async putFile(fileContent: string, key: string = ''): Promise<any> {
		return new Promise((putFileResolve, reject) => {
			const fileName = basename(key);
			const s3 = this.getS3Instance();
			const params = {
				Bucket: this.getS3Bucket(),
				Body: fileContent,
				Key: key,
				ContentDisposition: `inline; ${fileName}`
			};
			s3.putObject(params, async (err) => {
				if (err) {
					reject(err);
				} else {
					const size = await s3
						.headObject({ Key: key, Bucket: this.getS3Bucket() })
						.promise()
						.then((res) => res.ContentLength);

					const file = {
						originalname: fileName, // orignal file name
						size: size, // files in bytes
						filename: fileName,
						path: key, // Full path of the file
						key: key // Full path of the file
					};
					putFileResolve(this.mapUploadedFile(file));
				}
			});
		});
	}

	deleteFile(key: string): Promise<void> {
		const s3 = this.getS3Instance();
		const params = {
			Bucket: this.getS3Bucket(),
			Key: key
		};
		return new Promise((deleteFileResolve, reject) => {
			s3.deleteObject(params, function (err, data) {
				if (err) reject(err);
				else deleteFileResolve();
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
		file.url = this.url(file.key); // file.location;
		return file;
	}
}
