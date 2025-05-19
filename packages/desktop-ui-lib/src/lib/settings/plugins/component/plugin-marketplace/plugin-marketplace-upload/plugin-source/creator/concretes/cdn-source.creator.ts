import { FormGroup, Validators } from '@angular/forms';
import { SourceCreator } from '../source.creator';
import { ICDNSource, PluginSourceType } from '@gauzy/contracts';

export class CdnSourceCreator extends SourceCreator {
	public createSource(source?: ICDNSource): FormGroup {
		const base = this.createBaseSource(PluginSourceType.CDN, source);
		return this.fb.group({
			...base,
			url: [
				source?.url || '',
				[Validators.required, Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)]
			],
			integrity: [source?.integrity || ''],
			crossOrigin: [source?.crossOrigin || '', Validators.maxLength(50)]
		});
	}
}
