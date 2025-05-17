import { ICDNSource, IPluginSource } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';

export class CdnSourceStrategy implements ISourceStrategy {
	public appendToFormData(_: FormData, __: any): void {
		// No-op
	}

	public getSourceData(source: ICDNSource): Partial<IPluginSource> {
		return {
			type: source.type,
			url: source.url,
			integrity: source.integrity,
			crossOrigin: source.crossOrigin
		};
	}
}
