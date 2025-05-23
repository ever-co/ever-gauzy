import { IGauzySource, IPluginSource } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';

export class GauzySourceStrategy implements ISourceStrategy {
	public appendToFormData(formData: FormData, source: any, index?: number): void {
		if (source.file instanceof File) {
			formData.append(`files[${index}]`, source.file, source.file.name);
		}
	}

	public getSourceData(_: IGauzySource): Partial<IPluginSource> {
		return {
			// ^_^
		};
	}
}
