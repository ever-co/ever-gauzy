import { BadRequestException, createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import { FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { FileStorage } from '@gauzy/core';

const logger = new Logger('UploadedFilesStorage');

/**
 * Multi-file counterpart of the core `@UploadedFileStorage()` decorator: maps every
 * uploaded file on the request (`request.files`, populated by `LazyFilesInterceptor`)
 * through the active storage provider's `mapUploadedFile`.
 *
 * @returns `Promise<UploadedFile[]>` — an empty array when no files were sent.
 */
export const UploadedFilesStorage = createParamDecorator(
	async (data: FileStorageProviderEnum, ctx: ExecutionContext): Promise<UploadedFile[]> => {
		try {
			const request = ctx.switchToHttp().getRequest();
			const files: any[] = Array.isArray(request.files) ? request.files : [];
			const provider = new FileStorage().getProvider(data);
			return await Promise.all(files.map((file) => provider.mapUploadedFile(file)));
		} catch (error) {
			logger.error('Error while mapping uploaded files');
			throw new BadRequestException('Error while mapping uploaded files', error);
		}
	}
);
