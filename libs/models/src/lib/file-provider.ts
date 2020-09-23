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
	LOCAL = 'local',
	S3 = 's3'
}

export interface UploadedFile {
	fieldname: string;
	key: string; // path of the file in storage
	originalname: string; // orignal file name
	size: number; // files in bytes
	encoding?: string;
	mimetype?: string;
	filename: string;
	url: string; // file public url
	path: string; // Full path of the file
}

export interface S3FileStorageProviderConfig {
	aws_access_key_id?: string;
	aws_secret_access_key?: string;
	aws_default_region?: string;
	aws_bucket?: string;
}
