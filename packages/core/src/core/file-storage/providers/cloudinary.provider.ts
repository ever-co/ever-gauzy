import { Request } from 'express';
import * as multer from 'multer';
import * as moment from 'moment';
import { join } from 'path';
import { URL } from 'url';
import * as streamifier from 'streamifier';
import axios from 'axios';
import { ConfigOptions, UploadApiErrorResponse, UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { environment } from '@gauzy/config';
import { FileStorageOption, FileStorageProviderEnum, FileSystem, UploadedFile } from "@gauzy/contracts";
import { ICloudinaryConfig, isNotEmpty } from '@gauzy/common';
import { Provider } from './provider';
import { RequestContext } from './../../../core/context';

export class CloudinaryProvider extends Provider<CloudinaryProvider> {

    public config: ICloudinaryConfig & FileSystem;
    public readonly name = FileStorageProviderEnum.CLOUDINARY;
    public static instance: CloudinaryProvider;

    constructor() {
        super();
        this.setDefaultConfig();
    }

    public getInstance() {
        if (!CloudinaryProvider.instance) {
            CloudinaryProvider.instance = new CloudinaryProvider();
        }
        this.setCloudinaryConfig();
        return CloudinaryProvider.instance;
    }

    /**
     * Get cloudinary instance
     * @returns
     */
    private getCloudinaryInstance(): ConfigOptions {
        try {
            this.setCloudinaryConfig();
            return cloudinary.config({
                cloud_name: this.config.cloud_name,
                api_key: this.config.api_key,
                api_secret: this.config.api_secret,
                secure: this.config.secure
            });
        } catch (error) {
            console.log(`Error while retrieving ${FileStorageProviderEnum.CLOUDINARY} instance:`, error);
        }
    }

    /**
     *  Set Cloudinary Configuration
     */
    setDefaultConfig() {
        const { cloudinaryConfig } = environment;
        this.config = {
            rootPath: '',
            baseUrl: cloudinaryConfig.delivery_url,
            cloud_name: cloudinaryConfig.cloud_name,
            api_key: cloudinaryConfig.api_key,
            api_secret: cloudinaryConfig.api_secret,
            secure: cloudinaryConfig.secure
        }
    }

    /**
     * Set Cloudinary Configuration Run Time
     */
    setCloudinaryConfig() {
        const request = RequestContext.currentRequest();
        if (request) {
            const settings = request['tenantSettings'];
            if (isNotEmpty(settings)) {
                this.config = {
                    rootPath: '',
                    ...this.config
                };
                if (isNotEmpty(settings.cloudinary_cloud_name)) {
                    this.config['cloud_name'] = settings.cloudinary_cloud_name.trim();
                }
                if (isNotEmpty(settings.cloudinary_api_key)) {
                    this.config['api_key'] = settings.cloudinary_api_key.trim();
                }
                if (isNotEmpty(settings.cloudinary_api_secret)) {
                    this.config['api_secret'] = settings.cloudinary_api_secret.trim();
                }
                if (isNotEmpty(settings.cloudinary_api_secure)) {
                    this.config['secure'] = settings.cloudinary_api_secure;
                }
                if (isNotEmpty(settings.delivery_url)) {
                    const baseUrl = new URL(settings.delivery_url).toString();
                    this.config['baseUrl'] = baseUrl;
                }
            }
        } else {
            this.config = {
                rootPath: '',
                ...this.config
            };
        }
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
        /** Get cloudinary instance */
        this.getCloudinaryInstance();

        return new CloudinaryStorage({
            cloudinary: cloudinary,
            params: (_req: Request, file: Express.Multer.File) => {
                // A file extension, or filename extension, is a suffix at the end of a file.
                const format = file.originalname.split('.').pop();

                // A string or function that determines the destination path for uploaded
                const destination = dest instanceof Function ? dest(file) : dest;

                // A string or function that determines the destination image path for uploaded.
                const folder = join(destination).replace(/\\/g, '/');

                // A function that determines the name of the uploaded file.
                let public_id: string;
                if (filename) {
                    if (typeof filename === 'string') {
                        public_id = filename;
                    } else {
                        public_id = filename(file, format);
                    }
                } else {
                    public_id = `${prefix}-${moment().unix()}-${parseInt('' + Math.random() * 1000, 10)}`;
                }
                return {
                    public_id,
                    folder,
                    format
                }
            }
        });
    }

    /**
     *
     * @param fileURL
     * @returns
     */
    url(fileURL: string): string {
        if (!fileURL) {
            return null;
        }
        if (fileURL.startsWith('http')) {
            return fileURL;
        }
        return new URL(join(this.config.cloud_name, fileURL), this.config.baseUrl).toString();
    }

    /**
     *
     * @param filePath
     * @returns
     */
    path(filePath: string): string {
        if (!filePath) {
            return null;
        }
        if (filePath.startsWith('http')) {
            return filePath;
        }
        return new URL(join(this.config.cloud_name, filePath), this.config.baseUrl).toString();
    }

    /**
     *
     * @param file
     * @returns
     */
    async getFile(file: string): Promise<Buffer> {
        try {
            const response = await axios.get(this.url(file), { responseType: 'arraybuffer' });
            return Buffer.from(response.data, "utf-8");
        } catch (error) {
            console.log('Error while retriving cloudinary image from serer', error);
        }
    }

    /**
     *
     * @param file
     * @param path
     * @returns
     */
    async putFile(file: any, path: string = ''): Promise<UploadedFile> {
        return new Promise((resolve, reject) => {
            // A string or function that determines the destination image path for uploaded.
            const public_id = join(path).replace(/\\/g, '/');

            const stream = cloudinary.uploader.upload_stream({ public_id }, (error: UploadApiErrorResponse, result: UploadApiResponse) => {
                if (error) return reject(error);

                const uploaded_file = {
                    key: result.public_id,
                    size: result.bytes,
                    filename: result.public_id,
                    url: result.url,
                    path: result.secure_url
                };
                resolve(uploaded_file as any);
            });
            streamifier.createReadStream(file).pipe(stream);
        });
    }

    /**
    * Delete Cloudinary Image
    *
    * @param file
    */
    async deleteFile(file: string): Promise<void> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.destroy(file, (error: any, result: any) => {
                if (error) return reject(error);

                resolve(result);
            });
        });
    }

    /**
     * Map uploaded file for cloudinary provider
     *
     * @param file
     * @returns
     */
    mapUploadedFile(file: any): UploadedFile {
        if (isNotEmpty(file.filename)) {
            const filename = file.filename;
            file.key = filename;

            const originalname = filename.split('/').pop();
            file.filename = originalname;
        }
        return file;
    }
}
