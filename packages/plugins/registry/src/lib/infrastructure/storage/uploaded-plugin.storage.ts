import { BadRequestException, createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import { FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { FileStorage } from '@gauzy/core';

/**
 * Custom decorator to map uploaded plugin based on the specified storage provider.
 *
 * @param storageProvider - The storage provider enum.
 * @returns Promise<UploadedFile | undefined>
 *
 * @throws BadRequestException if there's an error mapping the file
 */
export const UploadedPluginStorage = createParamDecorator(
	async (storageProvider: FileStorageProviderEnum, ctx: ExecutionContext): Promise<UploadedFile> => {
		const logger = new Logger('UploadedPluginStorage');

		try {
			const request = ctx.switchToHttp().getRequest();

			// Return early if no file is uploaded
			if (!request?.file) {
				return null;
			}

			// If no storage provider is specified, default to LOCAL
			if (!storageProvider) {
				storageProvider = FileStorageProviderEnum.LOCAL;
			}

			// Get the appropriate file storage provider
			const fileStorage = new FileStorage();
			const provider = fileStorage.getProvider(storageProvider);

			// Map the uploaded file using the provider
			return await provider.mapUploadedFile(request.file);
		} catch (error) {
			// Log the error with structured information
			logger.error(`Error mapping uploaded file: ${error.message}`, error.stack);

			// Throw a more helpful exception with additional context
			throw new BadRequestException({
				message: 'Failed to process uploaded file',
				error: error.message,
				provider: storageProvider
			});
		}
	}
);
