import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ICDNSource, PluginSourceType } from '@gauzy/contracts';
import { patterns } from '../../../../../../../../constants';
import { SourceCreator } from '../source.creator';

export class CdnSourceCreator extends SourceCreator {
	public createSource(source?: ICDNSource): FormGroup {
		const base = this.createBaseSource(PluginSourceType.CDN, source);
		return new FormGroup({
			...base,
			url: new FormControl(source?.url || '', [Validators.required, Validators.pattern(patterns.websiteUrl)]),
			integrity: new FormControl(source?.integrity || ''),
			crossOrigin: new FormControl(source?.crossOrigin || '', Validators.maxLength(50))
		});
	}
}
