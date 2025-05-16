import { UploadedFile } from '@gauzy/contracts';
import { FileProcessingStrategy } from '../../shared/models/file-processing.interface';

export class FileProcessorContext {
	private strategy: FileProcessingStrategy;

	constructor(strategy: FileProcessingStrategy) {
		this.strategy = strategy;
	}

	public setStrategy(strategy: FileProcessingStrategy) {
		this.strategy = strategy;
	}

	public async process(files: File | File[], provider: any): Promise<UploadedFile | UploadedFile[]> {
		return this.strategy.process(files, provider);
	}
}
