import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { IOrganization } from '@gauzy/contracts';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-ai-authorize',
	templateUrl: './gauzy-ai-authorize.component.html',
	styleUrls: ['./gauzy-ai-authorize.component.scss'],
})
export class GauzyAIAuthorizeComponent implements OnInit, OnDestroy {
	public organization: IOrganization;

	readonly form: FormGroup = GauzyAIAuthorizeComponent.buildForm(this._fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			apiKey: [null, Validators.required],
			apiSecret: [null, Validators.required],
		});
	}

	constructor(
		private readonly _fb: FormBuilder,
	) { }

	ngOnInit() { }

	ngOnDestroy(): void { }
}
