import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormGroupDirective } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization } from '@gauzy/contracts';
import { GauzyAIService, Store } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-ai-authorize',
	templateUrl: './gauzy-ai-authorize.component.html',
	styleUrls: ['./gauzy-ai-authorize.component.scss'],
})
export class GauzyAIAuthorizeComponent implements OnInit, OnDestroy {

	@ViewChild('formDirective') formDirective: FormGroupDirective;

	readonly form: FormGroup = GauzyAIAuthorizeComponent.buildForm(this._fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			apiKey: [null, Validators.required],
			apiSecret: [null, Validators.required],
		});
	}

	public organization: IOrganization;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _store: Store,
		private readonly _gauzyAIService: GauzyAIService
	) { }

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }

	/**
	 *
	 * @returns
	 */
	async onSubmit() {
		if (!this.organization || this.form.invalid) {
			return;
		}
		try {
			const { apiKey, apiSecret } = this.form.value;
			const { id: organizationId } = this.organization;

			this._gauzyAIService.addIntegration({
				client_id: apiKey,
				client_secret: apiSecret,
				organizationId
			}).pipe(
				untilDestroyed(this)
			).subscribe();
		} catch (error) {
			console.log('Error while creating new integration for Gauzy AI', error);
		}
	}
}
