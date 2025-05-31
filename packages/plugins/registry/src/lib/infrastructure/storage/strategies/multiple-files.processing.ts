import { UploadedFile } from '@gauzy/contracts';
import { FileProcessingStrategy } from '../../../shared/models/file-processing.interface';
import { BadRequestException } from '@nestjs/common';

/**
 * Strategy for processing multiple files
 */
export class MultipleFilesProcessingStrategy implements FileProcessingStrategy {
	public async process(files: any[], provider: any): Promise<UploadedFile[]> {
		try {
			return Promise.all(files.map((file) => provider.mapUploadedFile(file)));
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
