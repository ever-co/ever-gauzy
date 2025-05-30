import { IGauzySource, IPluginSource } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';

export class GauzySourceStrategy implements ISourceStrategy<IGauzySource> {
	public appendToFormData(formData: FormData, source: IGauzySource): void {
		if (!source.file || !(source.file instanceof File)) {
			throw new Error('File is required for Gauzy Source.');
		}
		formData.append('file', source.file);
	}

	public getSourceData(source: IGauzySource): Partial<IPluginSource> {
		return {
			fileName: source.file.name
		};
	}
}
