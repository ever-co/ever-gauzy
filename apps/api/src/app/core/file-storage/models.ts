export interface FileStorageOption {
	dest: string | CallableFunction;
	provider?: ProviderEnum;
	prefix?: string;
	filename?: string | CallableFunction;
}

export interface FileSystem {
	rootPath: string;
	baseUrl?: string;
}

export enum ProviderEnum {
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
