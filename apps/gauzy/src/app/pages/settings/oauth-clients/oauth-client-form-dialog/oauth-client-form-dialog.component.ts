/**
 * Create/edit dialog for an OAuth client.
 *
 * Dual-purpose: when `client` is null it's a "register new app" form;
 * when `client` is set it's an edit form (clientId is read-only and
 * clientType is not editable after creation). Closes with the dialog
 * result payload ready to be passed to the HTTP service.
 */
import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import {
	IOAuthClient,
	IOAuthClientCreateInput,
	IOAuthClientUpdateInput,
	OAuthClientType,
	OAuthGrantType
} from '@gauzy/contracts';

// Mirror backend DTO bounds (see CreateOAuthClientDTO):
// redirect URIs must be http/https, access TTL ≤ 7 days, refresh TTL ≤ 90 days.
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const MAX_ACCESS_TTL = 7 * 24 * 60 * 60;
const MAX_REFRESH_TTL = 90 * 24 * 60 * 60;

/** Typed form model for the OAuth client create/edit dialog. */
export interface OAuthClientFormModel {
	name: FormControl<string>;
	description: FormControl<string | null>;
	clientType: FormControl<OAuthClientType>;
	redirectUris: FormArray<FormControl<string>>;
	allowedScopes: FormArray<FormControl<string>>;
	allowedGrantTypes: FormControl<OAuthGrantType[]>;
	pkceRequired: FormControl<boolean>;
	accessTokenTtl: FormControl<number>;
	refreshTokenTtl: FormControl<number>;
}

@Component({
	selector: 'ngx-oauth-client-form-dialog',
	templateUrl: './oauth-client-form-dialog.component.html',
	styleUrls: ['./oauth-client-form-dialog.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OAuthClientFormDialogComponent implements OnInit {
	// Note: kept as @Input() (not signal `input()`) because Nebular's
	// dialogService passes the value via direct property assignment on the
	// component instance, which is incompatible with read-only InputSignals.
	@Input() client: IOAuthClient | null = null;

	form!: FormGroup<OAuthClientFormModel>;
	readonly clientTypes = Object.values(OAuthClientType);
	readonly grantTypes = Object.values(OAuthGrantType);

	private readonly fb = inject(FormBuilder);
	private readonly dialogRef = inject<NbDialogRef<OAuthClientFormDialogComponent>>(NbDialogRef);

	get isEdit(): boolean {
		return !!this.client;
	}

	get redirectUris(): FormArray<FormControl<string>> {
		return this.form.get('redirectUris') as FormArray<FormControl<string>>;
	}

	get allowedScopes(): FormArray<FormControl<string>> {
		return this.form.get('allowedScopes') as FormArray<FormControl<string>>;
	}

	ngOnInit(): void {
		const c = this.client;
		this.form = this.fb.group<OAuthClientFormModel>({
			name: this.fb.control(c?.name ?? '', [Validators.required, Validators.maxLength(100)]),
			description: this.fb.control(c?.description ?? '', [Validators.maxLength(500)]),
			clientType: this.fb.control(c?.clientType ?? OAuthClientType.CONFIDENTIAL, [Validators.required]),
			redirectUris: this.fb.array<FormControl<string>>(
				(c?.redirectUris ?? ['']).map((u) =>
					this.fb.control(u, [Validators.required, Validators.pattern(HTTP_URL_PATTERN)])
				)
			),
			allowedScopes: this.fb.array<FormControl<string>>((c?.allowedScopes ?? []).map((s) => this.fb.control(s))),
			allowedGrantTypes: this.fb.control(c?.allowedGrantTypes ?? [OAuthGrantType.AUTHORIZATION_CODE], [Validators.required]),
			pkceRequired: this.fb.control(c?.pkceRequired ?? false),
			accessTokenTtl: this.fb.control(
				c?.accessTokenTtl ?? 86400,
				[Validators.required, Validators.min(60), Validators.max(MAX_ACCESS_TTL)]
			),
			refreshTokenTtl: this.fb.control(
				c?.refreshTokenTtl ?? 2592000,
				[Validators.required, Validators.min(60), Validators.max(MAX_REFRESH_TTL)]
			)
		});

		if (this.isEdit) {
			// clientType cannot change after creation
			this.form.get('clientType')?.disable();
		}
	}

	addRedirectUri(): void {
		this.redirectUris.push(
			this.fb.control('', [Validators.required, Validators.pattern(HTTP_URL_PATTERN)])
		);
	}

	removeRedirectUri(index: number): void {
		if (this.redirectUris.length > 1) {
			this.redirectUris.removeAt(index);
		}
	}

	addScope(): void {
		this.allowedScopes.push(this.fb.control(''));
	}

	removeScope(index: number): void {
		this.allowedScopes.removeAt(index);
	}

	save(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const raw = this.form.getRawValue();
		const name = raw.name.trim();
		const description = raw.description?.trim() || null;
		if (!name) {
			this.form.get('name')?.setErrors({ required: true });
			this.form.get('name')?.markAsTouched();
			return;
		}
		const redirectUris = raw.redirectUris
			.map((u) => u.trim())
			.filter((u) => u.length > 0);
		const allowedScopes = raw.allowedScopes
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		// Validate that we have at least one redirect URI after trimming
		if (redirectUris.length === 0) {
			this.form.get('redirectUris')?.setErrors({ atLeastOneRequired: true });
			this.form.get('redirectUris')?.markAsTouched();
			return;
		}

		if (this.isEdit) {
			const payload: IOAuthClientUpdateInput = {
				name,
				description,
				redirectUris,
				allowedScopes,
				allowedGrantTypes: raw.allowedGrantTypes,
				pkceRequired: raw.pkceRequired,
				accessTokenTtl: Number(raw.accessTokenTtl),
				refreshTokenTtl: Number(raw.refreshTokenTtl)
			};
			this.dialogRef.close(payload);
		} else {
			const payload: IOAuthClientCreateInput = {
				name,
				description,
				clientType: raw.clientType,
				redirectUris,
				allowedScopes,
				allowedGrantTypes: raw.allowedGrantTypes,
				pkceRequired: raw.pkceRequired,
				accessTokenTtl: Number(raw.accessTokenTtl),
				refreshTokenTtl: Number(raw.refreshTokenTtl)
			};
			this.dialogRef.close(payload);
		}
	}

	cancel(): void {
		this.dialogRef.close();
	}
}
