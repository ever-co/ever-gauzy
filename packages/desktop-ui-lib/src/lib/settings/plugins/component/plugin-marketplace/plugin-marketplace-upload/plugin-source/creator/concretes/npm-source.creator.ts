import { FormControl, FormGroup, Validators } from '@angular/forms';
import { INPMSource, PluginSourceType } from '@gauzy/contracts';
import { SourceCreator } from '../source.creator';

export class NpmSourceCreator extends SourceCreator {
	public createSource(source?: INPMSource): FormGroup {
		const base = this.createBaseSource(PluginSourceType.NPM, source);
		return new FormGroup({
			...base,
			name: new FormControl(source?.name || '', [
				Validators.required,
				Validators.pattern(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)
			]),
			registry: new FormControl(
				source?.registry || '',
				Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})(?:\/|[\w\-])*\/?$/)
			),
			private: new FormControl(source?.private || false),
			scope: new FormControl(source?.scope || '', Validators.pattern(/^@[a-z0-9-~][a-z0-9-._~]*$/))
		});
	}
}
