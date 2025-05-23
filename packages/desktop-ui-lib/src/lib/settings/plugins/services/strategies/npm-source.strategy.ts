import { INPMSource, IPluginSource } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';

export class NpmSourceStrategy implements ISourceStrategy {
	public appendToFormData(_: FormData, __: any): void {
		// No-op
	}

	public getSourceData(source: INPMSource): Partial<IPluginSource> {
		return {
			name: source.name,
			registry: source.registry,
			private: source.private,
			scope: source.scope
		};
	}
}
