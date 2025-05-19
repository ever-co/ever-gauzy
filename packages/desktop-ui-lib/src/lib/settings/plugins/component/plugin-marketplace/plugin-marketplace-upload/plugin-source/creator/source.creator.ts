import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPluginSource, PluginOSArch, PluginOSType, PluginSourceType } from '@gauzy/contracts';

export abstract class SourceCreator {
	constructor(protected fb: FormBuilder) {}

	public abstract createSource(source?: IPluginSource): FormGroup;

	protected createBaseSource(type: PluginSourceType, source?: IPluginSource): any {
		const sourceId = source?.id ? { id: [source.id] } : {};
		return {
			...sourceId,
			operatingSystem: [source?.operatingSystem || PluginOSType.WINDOWS, Validators.required],
			architecture: [source?.architecture || PluginOSArch.X64, Validators.required],
			type: [type]
		};
	}
}
