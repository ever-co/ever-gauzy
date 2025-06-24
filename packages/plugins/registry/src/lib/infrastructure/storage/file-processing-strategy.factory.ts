import { FileProcessingStrategy } from '../../shared/models/file-processing.interface';
import { MultipleFilesProcessingStrategy } from './strategies/multiple-files.processing';
import { SingleFileProcessingStrategy } from './strategies/single-file.processing';

export class FileProcessingStrategyFactory {
	static createStrategy(isMultiple: boolean): FileProcessingStrategy {
		return isMultiple ? new MultipleFilesProcessingStrategy() : new SingleFileProcessingStrategy();
	}
}
