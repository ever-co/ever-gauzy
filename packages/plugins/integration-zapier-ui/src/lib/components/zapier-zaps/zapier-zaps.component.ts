import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { tap, catchError, finalize, switchMap, map, distinctUntilChanged } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierZap, IZapierZapStep, IZapierCreateZapInput, ID } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-zaps',
	templateUrl: './zapier-zaps.component.html',
	styleUrls: ['./zapier-zaps.component.scss'],
	standalone: false
})
export class ZapierZapsComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;
	public creating = false;
	public showCreateForm = false;

	/** List of Zaps from the authenticated Zapier account */
	public zaps: IZapierZap[] = [];

	/** Zapier integration ID from route parameters */
	public integrationId: ID | null = null;

	/** Cached OAuth access token used for both read and create calls */
	private _accessToken: string | null = null;

	/** Reactive form used to create a new Zap */
	public createZapForm: FormGroup;

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _fb: FormBuilder,
		public readonly translateService: TranslateService,
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService
	) {
		super(translateService);
		this.createZapForm = this._buildCreateZapForm();
	}

	ngOnInit(): void {
		const parentRoute = this._activatedRoute.parent;
		if (!parentRoute) {
			this._showNoIntegrationError();
			return;
		}

		parentRoute.params
			.pipe(
				map((p: Params) => p['id']),
				distinctUntilChanged(),
				tap((id: ID) => {
					this.integrationId = id;
					this._loadZaps();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Accessor for the `steps` FormArray in the create-zap form.
	 */
	get stepsFormArray(): FormArray<FormGroup> {
		return this.createZapForm.get('steps') as FormArray<FormGroup>;
	}

	/**
	 * Build the reactive form with a single starter step.
	 */
	private _buildCreateZapForm(): FormGroup {
		return this._fb.group({
			title: ['', [Validators.required, Validators.maxLength(255)]],
			steps: this._fb.array([this._createStepGroup()], Validators.required)
		});
	}

	/**
	 * Build a single step FormGroup with the fields supported by the
	 * Zapier create-a-zap API payload.
	 */
	private _createStepGroup(): FormGroup {
		return this._fb.group({
			action: ['', [Validators.required]],
			authentication: [''],
			title: [''],
			// `inputs` is a JSON object in the API; users enter it as JSON text.
			inputs: ['']
		});
	}

	/**
	 * Toggle the create-zap form visibility. Resets the form when opening.
	 */
	toggleCreateForm(): void {
		this.showCreateForm = !this.showCreateForm;
		if (this.showCreateForm) {
			this.createZapForm = this._buildCreateZapForm();
		}
	}

	/**
	 * Append a new empty step to the create-zap form.
	 */
	addStep(): void {
		this.stepsFormArray.push(this._createStepGroup());
	}

	/**
	 * Remove a step from the create-zap form. A Zap must have at least one step.
	 */
	removeStep(index: number): void {
		if (this.stepsFormArray.length > 1) {
			this.stepsFormArray.removeAt(index);
		}
	}

	/**
	 * Submit the create-zap form and POST the payload via the Gauzy backend.
	 */
	submitCreateZap(): void {
		if (this.createZapForm.invalid) {
			this.createZapForm.markAllAsTouched();
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		if (!this._accessToken) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.NO_ACCESS_TOKEN'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		const payload = this._toCreateZapPayload();
		if (!payload) {
			// Validation error toast already shown by the converter.
			return;
		}

		this.creating = true;
		this._zapierService
			.createZap(payload, this._accessToken)
			.pipe(
				tap((zap: IZapierZap) => {
					this.zaps = [zap, ...this.zaps];
					this.showCreateForm = false;
					this.createZapForm = this._buildCreateZapForm();
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.SUCCESS.CREATE_ZAP'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._handleError(error, 'INTEGRATIONS.ZAPIER_PAGE.ERRORS.CREATE_ZAP');
					return EMPTY;
				}),
				finalize(() => (this.creating = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Convert the reactive form value into the API payload shape.
	 * Returns `null` if a step's `inputs` JSON cannot be parsed — in which
	 * case an error toast is shown.
	 */
	private _toCreateZapPayload(): IZapierCreateZapInput | null {
		const raw = this.createZapForm.getRawValue() as {
			title: string;
			steps: Array<{ action: string; authentication: string; title: string; inputs: string }>;
		};

		const steps: IZapierZapStep[] = [];
		for (const [index, step] of raw.steps.entries()) {
			let inputs: Record<string, any> | null = null;
			const inputsText = (step.inputs ?? '').trim();
			if (inputsText.length > 0) {
				try {
					const parsed = JSON.parse(inputsText);
					if (parsed !== null && typeof parsed !== 'object') {
						throw new Error('inputs must be a JSON object');
					}
					inputs = parsed as Record<string, any>;
				} catch {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_STEP_INPUTS', {
							step: index + 1
						}),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return null;
				}
			}

			steps.push({
				action: step.action.trim(),
				authentication: step.authentication?.trim() ? step.authentication.trim() : null,
				title: step.title?.trim() ? step.title.trim() : null,
				inputs
			});
		}

		return {
			title: raw.title.trim(),
			steps
		};
	}

	/**
	 * Loads the user's Zaps using the integration ID from route parameters.
	 */
	private _loadZaps(): void {
		if (!this.integrationId) {
			this._showNoIntegrationError();
			return;
		}

		// Clear cached access token before loading a new integration to prevent
		// using a stale token from a previous failed token fetch
		this._accessToken = null;
		this.loading = true;

		this._zapierService
			.getAccessToken(this.integrationId)
			.pipe(
				tap((accessToken: string) => (this._accessToken = accessToken)),
				switchMap((accessToken: string) => this._zapierService.getZaps(accessToken)),
				tap((zaps: IZapierZap[]) => {
					this.zaps = zaps;
				}),
				catchError((error) => {
					this._handleError(error, 'INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_ZAPS');
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _handleError(error: any, fallbackKey: string): void {
		if (error?.status === 404 || error?.message?.includes('not found')) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.TOKEN_NOT_FOUND'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} else if (error?.status === 401 || error?.message?.includes('access token')) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_TOKEN'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} else {
			this._toastrService.error(
				this.getTranslation(fallbackKey),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	private _showNoIntegrationError(): void {
		this._toastrService.error(
			this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.NO_INTEGRATION_ID'),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}
}
