import { IGauzySource, IPluginSource } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';

export class GauzySourceStrategy implements ISourceStrategy {
	public appendToFormData(formData: FormData, source: any): void {
		if (source.file instanceof File) {
			formData.append('file', source.file);
		}
	}

	public getSourceData(source: IGauzySource): Partial<IPluginSource> {
		return {
			fileName: source.file.name
		};
	}
}
