import { Request } from 'express';
import * as multer from 'multer';
import * as moment from 'moment';
import * as fs from 'fs';
import { join } from 'path';
import * as streamifier from 'streamifier';
import { UploadApiErrorResponse, UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { environment } from '@gauzy/config';
import { FileStorageOption, FileStorageProviderEnum, FileSystem, UploadedFile } from "@gauzy/contracts";
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

    /**
     * Handle file upload to the cloudinary storage
     *
     * @param param0
     * @returns
     */
    handler({
        dest,
        filename,
        prefix = 'file'
    }: FileStorageOption): multer.StorageEngine {
        return new CloudinaryStorage({
            cloudinary: cloudinary,
            params: (_req: Request, file: Express.Multer.File) => {
                console.log({ file });
                // A file extension, or filename extension, is a suffix at the end of a file.
                const format = file.originalname.split('.').pop();

                // A string or function that determines the destination path for uploaded
                const folder = dest instanceof Function ? dest(file) : dest;

                // A function that determines the name of the uploaded file.
                let fileName: string;
                if (filename) {
                    if (typeof filename === 'string') {
                        fileName = filename;
                    } else {
                        fileName = filename(file, format);
                    }
                } else {
                    fileName = `${prefix}-${moment().unix()}-${parseInt('' + Math.random() * 1000, 10)}`;
                }

                // A string or function that determines the destination image path for uploaded
                const public_id = join(folder, fileName).replace(/\\/g, '/');

                return {
                    public_id: public_id,
                    format
                }
            }
        });
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
            rootPath: '',
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
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream((error: UploadApiErrorResponse, result: UploadApiResponse) => {
                if (error) return reject(error);

                console.log(file, result);
                resolve({ url: result.url, id: result.public_id } as any);
            });
            streamifier.createReadStream(file).pipe(stream);
        });
    }

    /**
     * Map uploaded file for provider
     *
     * @param file
     * @returns
     */
    mapUploadedFile(file: any): UploadedFile {
        return file;
    }
}
