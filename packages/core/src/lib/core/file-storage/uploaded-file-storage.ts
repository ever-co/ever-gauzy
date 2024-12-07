import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { FileStorage } from './file-storage';

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
			// Log the error using a logger instead of console.log
			console.error('Error while mapping uploaded file', error);

			// Throw a more specific exception or create a custom exception class
			throw new BadRequestException('Error while mapping uploaded file', error);
		}
	}
);
