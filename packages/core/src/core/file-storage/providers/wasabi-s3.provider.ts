import { FileStorageOption, FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import * as multerS3 from 'multer-s3';
import { basename, join } from 'path';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
// import entire SDK
import * as AWS from 'aws-sdk';
import { StorageEngine } from 'multer';
import { Provider } from './provider';
import { RequestContext } from '../../context';
import { v4 as uuid } from 'uuid';

export interface IWasabiConfig {
	rootPath: string;
	wasabi_aws_access_key_id: string;
	wasabi_aws_secret_access_key: string;
	wasabi_aws_default_region: string;
	wasabi_aws_service_url: string;
	wasabi_aws_bucket: string;
}

export class WasabiS3Provider extends Provider<WasabiS3Provider> {
	static instance: WasabiS3Provider;

	name = FileStorageProviderEnum.WASABI;
	tenantId: string;

	config: IWasabiConfig;
	defaultConfig: IWasabiConfig;

	constructor() {
		super();
		this.config = this.defaultConfig = {
			rootPath: '',
			wasabi_aws_access_key_id: environment.wasabiConfig.accessKeyId,
			wasabi_aws_secret_access_key: environment.wasabiConfig.secretAccessKey,
			wasabi_aws_default_region: environment.wasabiConfig.region,
			wasabi_aws_service_url: environment.wasabiConfig.serviceUrl,
			wasabi_aws_bucket: environment.wasabiConfig.s3.bucket
		};
	}

	getInstance() {
		if (!WasabiS3Provider.instance) {
			WasabiS3Provider.instance = new WasabiS3Provider();
		}
		this.setWasabiDetails();
		return WasabiS3Provider.instance;
	}

	url(key: string) {
		const url = this.getWasabiInstance().getSignedUrl('getObject', {
			Bucket: this.getWasabiBucket(),
			Key: key,
			Expires: 3600
		});
		return url;
	}

	setWasabiDetails() {
		const request = RequestContext.currentRequest();
		if (request) {
			const settings = request['tenantSettings'];
			if (
				settings &&
				settings.wasabi_aws_access_key_id &&
				isNotEmpty(settings.wasabi_aws_access_key_id.trim()) &&
				settings.wasabi_aws_secret_access_key &&
				isNotEmpty(settings.wasabi_aws_secret_access_key.trim())
			) {
				this.config = {
					...this.defaultConfig,
					wasabi_aws_access_key_id: settings.wasabi_aws_access_key_id,
					wasabi_aws_secret_access_key: settings.wasabi_aws_secret_access_key,
					wasabi_aws_default_region: settings.wasabi_aws_default_region,
					wasabi_aws_service_url: settings.wasabi_aws_service_url,
					wasabi_aws_bucket: settings.wasabi_aws_bucket
				};
			}
		} else {
			this.config = {
				...this.defaultConfig
			};
		}
	}

	path(filePath: string) {
		return filePath ? this.config.rootPath + '/' + filePath : null;
	}

	handler({ dest, filename, prefix }: FileStorageOption): StorageEngine {
		return multerS3({
			s3: this.getWasabiInstance(),
			bucket: this.getWasabiBucket(),
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
					if (!prefix) {
						prefix = 'file';
					}
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
						dir,
						user ? user.tenantId : uuid(),
						fileNameString
					)
				);
			}
		});
	}

	async getFile(key: string): Promise<Buffer> {
		const s3 = this.getWasabiInstance();
		const params = {
			Bucket: this.getWasabiBucket(),
			Key: key
		};

		const data = await s3.getObject(params).promise();
		return data.Body as Buffer;
	}

	async putFile(fileContent: string, key: string = ''): Promise<any> {
		return new Promise((putFileResolve, reject) => {
			const fileName = basename(key);
			const s3 = this.getWasabiInstance();
			const params = {
				Bucket: this.getWasabiBucket(),
				Body: fileContent,
				Key: key,
				ContentDisposition: `inline; ${fileName}`
			};

			s3.putObject(params, async (err) => {
				if (err) {
					reject(err);
				} else {
					const size = await s3
						.headObject({ Key: key, Bucket: this.getWasabiBucket() })
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
		const s3 = this.getWasabiInstance();
		const params = {
			Bucket: this.getWasabiBucket(),
			Key: key
		};
		return new Promise((deleteFileResolve, reject) => {
			s3.deleteObject(params, function (err) {
				if (err) reject(err);
				else deleteFileResolve();
			});
		});
	}

	private getWasabiInstance() {
		this.setWasabiDetails();

		const endpoint = new AWS.Endpoint('s3.wasabisys.com');
		return new AWS.S3({
			accessKeyId: this.config.wasabi_aws_access_key_id,
			secretAccessKey: this.config.wasabi_aws_secret_access_key,
			region: this.config.wasabi_aws_default_region,
			endpoint: endpoint
		});
	}

	getWasabiBucket() {
		this.setWasabiDetails();
		return this.config.wasabi_aws_bucket;
	}

	mapUploadedFile(file): UploadedFile {
		file.filename = file.originalname;
		file.url = this.url(file.key); // file.location;
		return file;
	}
}
