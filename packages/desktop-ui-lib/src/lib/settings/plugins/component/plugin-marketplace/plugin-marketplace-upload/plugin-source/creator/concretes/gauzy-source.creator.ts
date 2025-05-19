import { FormGroup, Validators } from '@angular/forms';
import { SourceCreator } from '../source.creator';
import { IGauzySource, PluginSourceType } from '@gauzy/contracts';

export class GauzySourceCreator extends SourceCreator {
	public createSource(source?: IGauzySource): FormGroup {
		const base = this.createBaseSource(PluginSourceType.GAUZY, source);
		return this.fb.group({
			...base,
			file: [source?.file || null, Validators.required]
		});
	}
}
