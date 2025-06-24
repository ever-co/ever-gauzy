import { IPluginSource } from '@gauzy/contracts';

// Strategy Pattern for different source types
export interface ISourceStrategy<T = unknown> {
	appendToFormData(formData?: FormData, source?: T): void;
	getSourceData(source: T): Partial<IPluginSource>;
}
