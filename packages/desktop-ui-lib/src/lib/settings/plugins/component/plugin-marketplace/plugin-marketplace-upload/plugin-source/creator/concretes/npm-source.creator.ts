import { FormGroup, Validators } from '@angular/forms';
import { SourceCreator } from '../source.creator';
import { INPMSource, PluginSourceType } from '@gauzy/contracts';

export class NpmSourceCreator extends SourceCreator {
	public createSource(source?: INPMSource): FormGroup {
		const base = this.createBaseSource(PluginSourceType.NPM, source);
		return this.fb.group({
			...base,
			name: [
				source?.name || '',
				[Validators.required, Validators.pattern(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)]
			],
			registry: [
				source?.registry || '',
				Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
			],
			private: [source?.private || false],
			scope: [source?.scope || '', Validators.pattern(/^@[a-z0-9-~][a-z0-9-._~]*$/)]
		});
	}
}
