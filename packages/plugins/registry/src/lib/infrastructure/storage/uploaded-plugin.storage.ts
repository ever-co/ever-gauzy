import { BadRequestException, createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import { FileStorageProviderEnum, UploadedFile } from '@gauzy/contracts';
import { FileStorage } from '@gauzy/core';
import { FileProcessingStrategyFactory } from './file-processing-strategy.factory';
import { FileProcessorContext } from './file-processor.context';

/**
 * Custom decorator to map uploaded plugin based on the specified storage provider.
 *
 * @param storageProvider - The storage provider enum.
 * @returns Promise<UploadedFile | undefined>
 *
 * @throws BadRequestException if there's an error mapping the file
 */
export const UploadedPluginStorage = createParamDecorator(
	async (
		options: { storageProvider?: FileStorageProviderEnum; multiple?: boolean },
		ctx: ExecutionContext
	): Promise<UploadedFile | UploadedFile[]> => {
		const logger = new Logger('UploadedPluginStorage');

		try {
			const request = ctx.switchToHttp().getRequest();
			const { storageProvider = FileStorageProviderEnum.LOCAL, multiple = false } = options;

			// Get files from request
			const files = multiple ? request?.files : request?.file;

			if (!files || (multiple && files.length === 0)) {
				return null;
			}

			// Validate multiple files case
			if (multiple && !Array.isArray(files)) {
				return [];
			}

			// Create appropriate processing strategy
			const strategy = FileProcessingStrategyFactory.createStrategy(multiple);
			const processor = new FileProcessorContext(strategy);

			// Get the appropriate file storage provider
			const fileStorage = new FileStorage();
			const provider = fileStorage.getProvider(storageProvider);

			// Process files using the selected strategy
			return processor.process(files, provider);
		} catch (error) {
			// Log the error with structured information
			logger.error(`Error mapping uploaded file: ${error.message}`, error.stack);

			// Throw a more helpful exception with additional context
			throw new BadRequestException({
				message: 'Failed to process uploaded file',
				error: error.message,
				provider: options.storageProvider
			});
		}
	}
);
