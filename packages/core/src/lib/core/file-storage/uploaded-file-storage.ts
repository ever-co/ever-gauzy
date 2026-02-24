import { BadRequestException, createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import { FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { FileStorage } from './file-storage';

const logger = new Logger('UploadedFileStorage');

/**
 * Custom decorator to map uploaded files based on the specified storage provider.
 * @param data - The storage provider enum.
 * @returns Promise<UploadedFile>
 */
export const UploadedFileStorage = createParamDecorator(
	async (data: FileStorageProviderEnum, ctx: ExecutionContext): Promise<UploadedFile> => {
		try {
			const request = ctx.switchToHttp().getRequest();
			const provider = new FileStorage().getProvider(data);
			return await provider.mapUploadedFile(request.file);
		} catch (error) {
			logger.error('Error while mapping uploaded file');

			// Throw a more specific exception or create a custom exception class
			throw new BadRequestException('Error while mapping uploaded file', error);
		}
	}
);
