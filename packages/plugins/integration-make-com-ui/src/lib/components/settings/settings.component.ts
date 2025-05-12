import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-make-com-settings',
	template: `
		<nb-card>
			<nb-card-header>
				<h4>{{ 'INTEGRATIONS.MAKE_COM.SETTINGS.TITLE' | translate }}</h4>
			</nb-card-header>
			<nb-card-body>
				<form [formGroup]="form" (ngSubmit)="onSubmit()">
					<div class="form-group">
						<nb-form-field>
							<label nbLabel>{{ 'INTEGRATIONS.MAKE_COM.SETTINGS.API_KEY' | translate }}</label>
							<input
								nbInput
								fullWidth
								formControlName="apiKey"
								[placeholder]="'INTEGRATIONS.MAKE_COM.SETTINGS.API_KEY_PLACEHOLDER' | translate"
							/>
						</nb-form-field>
					</div>
					<div class="form-group">
						<nb-form-field>
							<label nbLabel>{{ 'INTEGRATIONS.MAKE_COM.SETTINGS.API_SECRET' | translate }}</label>
							<input
								nbInput
								fullWidth
								type="password"
								formControlName="apiSecret"
								[placeholder]="'INTEGRATIONS.MAKE_COM.SETTINGS.API_SECRET_PLACEHOLDER' | translate"
							/>
						</nb-form-field>
					</div>
					<button nbButton status="primary" type="submit" [disabled]="!form.valid">
						{{ 'INTEGRATIONS.MAKE_COM.SETTINGS.SAVE' | translate }}
					</button>
				</form>
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.form-group {
				margin-bottom: 1rem;
			}
		`
	]
})
export class SettingsComponent implements OnInit {
	form: FormGroup;

	constructor(
		private readonly fb: FormBuilder,
		private readonly translateService: TranslateService
	) {
		this.form = this.fb.group({
			apiKey: ['', [Validators.required]],
			apiSecret: ['', [Validators.required]]
		});
	}

	ngOnInit(): void {
		// TODO: Load existing settings if any
	}

	onSubmit(): void {
		if (this.form.valid) {
			// TODO: Save settings
			console.log('Form submitted:', this.form.value);
		}
	}
}
