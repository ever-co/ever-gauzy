import { UploadedFile } from '@gauzy/contracts';
import { FileProcessingStrategy } from '../../../shared/models/file-processing.interface';

/**
 * Strategy for processing single file
 */
export class SingleFileProcessingStrategy implements FileProcessingStrategy {
	public async process(file: any, provider: any): Promise<UploadedFile> {
		return provider.mapUploadedFile(file);
	}
}
