import { Request } from 'express';
import * as multer from 'multer';
import * as fs from 'fs';
import { UploadApiErrorResponse, UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { environment } from '@gauzy/config';
import { FileStorageOption, FileStorageProviderEnum, FileSystem, UploadedFile } from '@gauzy/contracts';
import { ICloudinaryConfig } from '@gauzy/common';
import { Provider } from './provider';

export class CloudinaryProvider extends Provider<CloudinaryProvider> {
	public config: ICloudinaryConfig & FileSystem;
	public readonly name = FileStorageProviderEnum.CLOUDINARY;
	public static instance: CloudinaryProvider;

	constructor() {
		super();
		this.setConfig();
	}

	getInstance() {
		if (!CloudinaryProvider.instance) {
			CloudinaryProvider.instance = new CloudinaryProvider();
		}
		return CloudinaryProvider.instance;
	}

	handler({ dest, filename, prefix }: FileStorageOption): multer.StorageEngine {
		return multer.diskStorage({
			destination: (_req: Request, file: Express.Multer.File, callback) => {
				console.log({ file }, 'destination express multer file');
			},
			filename: (_req: Request, file: Express.Multer.File, callback) => {
				console.log({ file }, 'filename express multer file');
			}
		});
	}

	async deleteFile(file: string): Promise<void> {}

	url(path: string): string {
		try {
			return path;
		} catch (error) {
			console.log('Error while retrieving singed URL:', error);
		}
	}
	path(path: string): string {
		try {
			return path;
		} catch (error) {
			console.log('Error while retrieving singed URL:', error);
		}
	}

	/**
	 *  Set Cloudinary Configuration
	 */
	setConfig() {
		this.config = {
			rootPath: '',
			...cloudinary.config({
				cloud_name: environment.cloudinaryConfig.cloudName,
				api_key: environment.cloudinaryConfig.apiKey,
				api_secret: environment.cloudinaryConfig.apiSecret,
				secure: environment.cloudinaryConfig.secure
			})
		};
	}

	async getFile(file: string): Promise<Buffer> {
		return await fs.promises.readFile(this.path(file));
	}

	async putFile(file: any, path: string = ''): Promise<UploadedFile> {
		return new Promise((resolve, reject) => {
			cloudinary.uploader.upload(file, (error: UploadApiErrorResponse, result: UploadApiResponse) => {
				if (error) {
					return reject(error);
				}
				return resolve({ url: result.url, id: result.public_id } as any);
			});
		});
	}
}
