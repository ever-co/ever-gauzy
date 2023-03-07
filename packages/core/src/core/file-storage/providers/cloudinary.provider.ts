import { Request } from 'express';
import * as multer from 'multer';
import * as moment from 'moment';
import * as fs from 'fs';
import { join, resolve } from 'path';
import { UploadApiErrorResponse, UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { environment, getConfig } from '@gauzy/config';
import { FileStorageOption, FileStorageProviderEnum, FileSystem, UploadedFile } from "@gauzy/contracts";
import { ICloudinaryConfig } from '@gauzy/common';
import { Provider } from './provider';

const config = getConfig();

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

    handler({
        dest,
        filename,
        prefix = 'file'
    }: FileStorageOption): multer.StorageEngine {
        const diskStorage = multer.diskStorage({
            destination: (_req: Request, file: Express.Multer.File, callback) => {
                // A string or function that determines the destination path for uploaded
                let dir: string;
                if (dest instanceof Function) {
                    dir = dest(file);
                } else {
                    dir = dest;
                }

                // In "screenshots" folder we will temporarily upload image before uploading to cloudinary
                const fullPath = join(this.config.rootPath, dir);
                console.log({ fullPath }, file.path);

                // Creating screenshots folder if not already present.
                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                }
                callback(null, fullPath);
            },
            filename: (_req: Request, file: Express.Multer.File, callback) => {
                console.log(file.path, 'File Path');

                // A file extension, or filename extension, is a suffix at the end of a file.
                const extension = file.originalname.split('.').pop();

                // A function that determines the name of the uploaded file.
                let fileName: string;
                if (filename) {
                    if (typeof filename === 'string') {
                        fileName = filename;
                    } else {
                        fileName = filename(file, extension);
                    }
                } else {
                    fileName = `${prefix}-${moment().unix()}-${parseInt('' + Math.random() * 1000, 10)}.${extension}`;
                }
                callback(null, fileName);
            }
        });
        console.log(diskStorage);
        return diskStorage;
    }

    async deleteFile(file: string): Promise<void> { }

    url(fileURL: string): string {
        if (fileURL && fileURL.startsWith('http')) {
            return fileURL;
        }
        return fileURL ? `${this.config.baseUrl}/${fileURL}` : null;
    }

    path(filePath: string): string {
        return filePath ? `${this.config.rootPath}/${filePath}` : null;
    }

    /**
     *  Set Cloudinary Configuration
     */
    setConfig() {
        this.config = {
            rootPath: config.assetOptions.assetPublicPath || resolve(process.cwd(), 'apps', 'api', 'public'),
            baseUrl: environment.baseUrl + '/public',
            ...cloudinary.config({
                cloud_name: environment.cloudinaryConfig.cloudName,
                api_key: environment.cloudinaryConfig.apiKey,
                api_secret: environment.cloudinaryConfig.apiSecret,
                secure: environment.cloudinaryConfig.secure
            })
        }
    }

    async getFile(file: string): Promise<Buffer> {
        return await fs.promises.readFile(this.path(file));
    }

    async putFile(file: any, path: string = ''): Promise<UploadedFile> {
        console.log('Cloudinary File Upload', file, path);
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(this.path(path), (error: UploadApiErrorResponse, result: UploadApiResponse) => {
                console.log(error, result);
                if (error) {
                    return reject(error);
                }
                // Image has been successfully uploaded on cloudinary so we don't need local image file anymore
                // Remove file from local uploads folder
                fs.unlinkSync(this.path(path));
                return resolve({ url: result.url, id: result.public_id } as any);
            });
        });
    }

    /**
     * Map uploaded file for provider
     *
     * @param file
     * @returns
     */
    mapUploadedFile(file: any): UploadedFile {
        const separator = process.platform === 'win32' ? '\\' : '/';
        if (file.path) {
            file.key = file.path.replace(this.config.rootPath + separator, '');
        }
        file.url = this.url(file.key);
        return file;
    }
}
