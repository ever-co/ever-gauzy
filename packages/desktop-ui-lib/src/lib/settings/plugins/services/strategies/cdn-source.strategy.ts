import { ICDNSource, IPluginSource } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';

export class CdnSourceStrategy implements ISourceStrategy<ICDNSource> {
	public appendToFormData(): void {
		// No-op
	}

	public getSourceData(source: ICDNSource): Partial<IPluginSource> {
		return {
			url: source.url,
			integrity: source.integrity,
			crossOrigin: source.crossOrigin
		};
	}
}
