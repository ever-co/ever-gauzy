import { FormControl, FormGroup, Validators } from '@angular/forms';
import { IPluginSource, PluginOSArch, PluginOSType, PluginSourceType } from '@gauzy/contracts';

export abstract class SourceCreator {
	public abstract createSource(source?: IPluginSource): FormGroup;

	protected createBaseSource(type: PluginSourceType, source?: IPluginSource) {
		const sourceId = source?.id ? { id: new FormControl(source.id) } : {};
		return {
			...sourceId,
			operatingSystem: new FormControl(source?.operatingSystem || PluginOSType.UNIVERSAL, Validators.required),
			architecture: new FormControl(source?.architecture || PluginOSArch.X64, Validators.required),
			type: new FormControl(type)
		};
	}
}
