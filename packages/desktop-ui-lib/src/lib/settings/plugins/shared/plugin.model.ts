import { IPluginSource } from '@gauzy/contracts';

// Strategy Pattern for different source types
export interface ISourceStrategy {
	appendToFormData(formData: FormData, source: any, index?: number): void;
	getSourceData(source: any): Partial<IPluginSource>;
}
