import { FormControl, FormGroup, Validators } from '@angular/forms';
import { IGauzySource, PluginSourceType } from '@gauzy/contracts';
import { SourceCreator } from '../source.creator';

export class GauzySourceCreator extends SourceCreator {
	public createSource(source?: IGauzySource): FormGroup {
		const base = this.createBaseSource(PluginSourceType.GAUZY, source);
		return new FormGroup({
			...base,
			file: new FormControl(source?.file || null, Validators.required)
		});
	}
}
