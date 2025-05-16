import { UploadedFile } from '@gauzy/contracts';
import { FileProcessingStrategy } from '../../../shared/models/file-processing.interface';

/**
 * Strategy for processing multiple files
 */
export class MultipleFilesProcessingStrategy implements FileProcessingStrategy {
	public async process(files: File[], provider: any): Promise<UploadedFile[]> {
		return Promise.all(files.map((file) => provider.mapUploadedFile(file)));
	}
}
