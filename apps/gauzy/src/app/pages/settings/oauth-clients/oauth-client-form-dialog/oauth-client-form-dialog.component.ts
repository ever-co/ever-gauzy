/**
 * Create/edit dialog for an OAuth client.
 *
 * Dual-purpose: when `client` is null it's a "register new app" form;
 * when `client` is set it's an edit form (clientId is read-only and
 * clientType is not editable after creation). Closes with the dialog
 * result payload ready to be passed to the HTTP service.
 */
import { Component, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import {
	IOAuthClient,
	IOAuthClientCreateInput,
	IOAuthClientUpdateInput,
	OAuthClientType,
	OAuthGrantType
} from '@gauzy/contracts';

@Component({
	selector: 'ngx-oauth-client-form-dialog',
	templateUrl: './oauth-client-form-dialog.component.html',
	styleUrls: ['./oauth-client-form-dialog.component.scss'],
	standalone: false
})
export class OAuthClientFormDialogComponent implements OnInit {
	@Input() client: IOAuthClient | null = null;

	form!: FormGroup;
	readonly clientTypes = Object.values(OAuthClientType);
	readonly grantTypes = Object.values(OAuthGrantType);

	constructor(
		private readonly fb: FormBuilder,
		private readonly dialogRef: NbDialogRef<OAuthClientFormDialogComponent>
	) {}

	get isEdit(): boolean {
		return !!this.client;
	}

	get redirectUris(): FormArray {
		return this.form.get('redirectUris') as FormArray;
	}

	get allowedScopes(): FormArray {
		return this.form.get('allowedScopes') as FormArray;
	}

	ngOnInit(): void {
		const c = this.client;
		this.form = this.fb.group({
			name: [c?.name ?? '', [Validators.required, Validators.maxLength(100)]],
			description: [c?.description ?? '', [Validators.maxLength(500)]],
			clientType: [c?.clientType ?? OAuthClientType.CONFIDENTIAL, [Validators.required]],
			redirectUris: this.fb.array(
				(c?.redirectUris ?? ['']).map((u) => this.fb.control(u, [Validators.required]))
			),
			allowedScopes: this.fb.array((c?.allowedScopes ?? []).map((s) => this.fb.control(s))),
			allowedGrantTypes: [c?.allowedGrantTypes ?? [OAuthGrantType.AUTHORIZATION_CODE], [Validators.required]],
			pkceRequired: [c?.pkceRequired ?? false],
			accessTokenTtl: [c?.accessTokenTtl ?? 86400, [Validators.required, Validators.min(60)]],
			refreshTokenTtl: [c?.refreshTokenTtl ?? 2592000, [Validators.required, Validators.min(60)]]
		});

		if (this.isEdit) {
			// clientType cannot change after creation
			this.form.get('clientType')?.disable();
		}
	}

	addRedirectUri(): void {
		this.redirectUris.push(this.fb.control('', [Validators.required]));
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
		const redirectUris: string[] = (raw.redirectUris as string[]).map((u) => u.trim()).filter(Boolean);
		const allowedScopes: string[] = (raw.allowedScopes as string[]).map((s) => s.trim()).filter(Boolean);

		if (this.isEdit) {
			const payload: IOAuthClientUpdateInput = {
				name: raw.name,
				description: raw.description || null,
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
				name: raw.name,
				description: raw.description || null,
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
