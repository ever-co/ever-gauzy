export interface FileStorageOption {
	dest: string | CallableFunction;
	provider?: FileStorageProviderEnum;
	prefix?: string;
	filename?: string | CallableFunction;
}

export interface FileSystem {
	rootPath: string;
	baseUrl?: string;
}

export enum FileStorageProviderEnum {
	LOCAL = 'LOCAL',
	S3 = 'S3',
	WASABI = 'WASABI',
	CLOUDINARY = 'CLOUDINARY',
	DIGITALOCEAN = 'DIGITALOCEAN'
}

export interface UploadedFile {
	fieldname: string;
	key: string; // path of the file in storage
	originalname: string; // original file name
	size: number; // files in bytes
	encoding?: string;
	mimetype?: string;
	filename: string;
	url: string; // file public url
	path: string; // Full path of the file
}

export interface IS3FileStorageProviderConfig {
	aws_access_key_id?: string;
	aws_secret_access_key?: string;
	aws_default_region?: string;
	aws_bucket?: string;
	aws_force_path_style?: boolean;
}

export interface IWasabiFileStorageProviderConfig {
	wasabi_aws_access_key_id?: string;
	wasabi_aws_secret_access_key?: string;
	wasabi_aws_default_region?: string;
	wasabi_aws_service_url?: string;
	wasabi_aws_bucket?: string;
	wasabi_aws_force_path_style?: boolean;
}

export interface ICloudinaryFileStorageProviderConfig {
	cloudinary_cloud_name?: string;
	cloudinary_api_key?: string;
	cloudinary_api_secret?: string;
}

export interface IDigitalOceanFileStorageProviderConfig {
	digitalocean_access_key_id?: string;
	digitalocean_secret_access_key?: string;
	digitalocean_default_region?: string;
	digitalocean_service_url?: string;
	digitalocean_cdn_url?: string;
	digitalocean_s3_bucket?: string;
	digitalocean_s3_force_path_style?: boolean;
}
