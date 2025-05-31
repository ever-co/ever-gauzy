import { UploadedFile } from '@gauzy/contracts';

/**
 * Interface for file processing strategy
 */
export interface FileProcessingStrategy {
	process(file: any, provider: any): Promise<UploadedFile | UploadedFile[]>;
}
