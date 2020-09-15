import { StorageEngine } from 'multer';

export interface FileStorageOption {
	dest: string | CallableFunction;
	provider?: ProviderEnum;
	prefix?: string;
	filename?: string | CallableFunction;
}

export interface FileSystem {
	rootPath: string;
	baseUrl: string;
}

export enum ProviderEnum {
	LOCAL = 'local',
	S3 = 's3'
}

export interface FileSystemProviderStatic {
	instance?: FileSystemProvider;
	name?: string;
	url?(path: string): string;
	path?(path: string): string;
}

export interface FileSystemProvider {
	name: string;
	tenantId?: string;
	config: FileSystem;
	url(path: string): string;
	path(path: string): string;
	getInstance(): FileSystemProvider;
	handler(options: FileStorageOption): StorageEngine;
}
