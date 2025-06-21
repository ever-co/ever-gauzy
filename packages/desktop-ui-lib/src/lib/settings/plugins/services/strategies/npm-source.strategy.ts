import { INPMSource, IPluginSource } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';

export class NpmSourceStrategy implements ISourceStrategy<INPMSource> {
	public appendToFormData(): void {
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
