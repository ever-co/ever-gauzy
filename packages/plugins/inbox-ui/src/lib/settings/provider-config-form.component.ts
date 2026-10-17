import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbCheckboxModule, NbInputModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { IEmailProviderConfigSchema, IInboxProviderAccount } from '@gauzy/contracts';
import {
	IProviderConfigError,
	IProviderConfigField,
	IProviderConfigFormState,
	isSecretSet,
	providerConfigFields
} from './provider-config-form.helpers';

/**
 * The generic form of a provider account (Settings → Inbox → Providers, G-P4-2): renders a provider plugin's
 * `configSchema` with Nebular controls — text (email / URL / host name), multi-line text, number, on/off, a choice
 * (`enum`) and secrets — with the plugin's labels and help texts and the required marks.
 *
 * Secrets are write-only. A `writeOnly` field is an empty password input that says whether a value is stored ("Set"):
 * left empty it keeps the stored value, typed it replaces it, and an optional one can be cleared. A `generated` field
 * has no input at all: the server generates it and shows it once; an edit can ask for a new one. The stored value is
 * never in the form, because the API never answers it.
 *
 * Presentational: the state is the caller's (`[(state)]`), and so are the errors it decides to show.
 */
@Component({
	selector: 'ngx-inbox-provider-config-form',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbCheckboxModule, NbInputModule, NbSelectModule, NbToggleModule, TranslatePipe],
	template: `
		<div class="config-form" data-test="config-form">
			@for (field of fields(); track field.name) {
				<div class="field" [attr.data-test]="'field-' + field.name">
					@if (field.control !== 'boolean') {
						<label class="label" [attr.for]="inputId(field)">
							{{ field.label }}
							@if (field.required && field.control !== 'generated') {
								<span class="required" aria-hidden="true">*</span>
							}
							@if (field.secret) {
								@if (isSet(field)) {
									<span class="chip chip-success" [attr.data-test]="'secret-set-' + field.name">{{
										'INBOX.SETTINGS.FORM.SECRET_SET' | translate
									}}</span>
								} @else if (account()) {
									<span class="chip" [attr.data-test]="'secret-not-set-' + field.name">{{
										'INBOX.SETTINGS.FORM.SECRET_NOT_SET' | translate
									}}</span>
								}
							}
						</label>
					}
					@switch (field.control) {
						@case ('boolean') {
							<nb-toggle
								[attr.data-test]="'input-' + field.name"
								[checked]="value(field) === true"
								[disabled]="disabled()"
								(checkedChange)="set(field, $event)"
							>
								{{ field.label }}
								@if (field.required) {
									<span class="required" aria-hidden="true">*</span>
								}
							</nb-toggle>
						}
						@case ('enum') {
							<nb-select
								fullWidth
								size="small"
								[attr.data-test]="'input-' + field.name"
								[attr.id]="inputId(field)"
								[placeholder]="'INBOX.SETTINGS.FORM.CHOOSE' | translate"
								[selected]="value(field)"
								[disabled]="disabled()"
								(selectedChange)="set(field, $event)"
							>
								@if (!field.required) {
									<nb-option [value]="null">{{ 'INBOX.SETTINGS.FORM.NONE' | translate }}</nb-option>
								}
								@for (option of field.options; track option) {
									<nb-option [value]="option">{{ option }}</nb-option>
								}
							</nb-select>
						}
						@case ('textarea') {
							<textarea
								nbInput
								fullWidth
								rows="4"
								spellcheck="false"
								[attr.data-test]="'input-' + field.name"
								[attr.id]="inputId(field)"
								[attr.maxlength]="field.property.maxLength ?? null"
								[disabled]="disabled()"
								[ngModel]="value(field)"
								[ngModelOptions]="standalone"
								(ngModelChange)="set(field, $event)"
							></textarea>
						}
						@case ('generated') {
							@if (!account()) {
								<p class="hint" [attr.data-test]="'generated-' + field.name">
									{{ 'INBOX.SETTINGS.FORM.GENERATED_ON_CREATE' | translate }}
								</p>
							} @else {
								<nb-checkbox
									[attr.data-test]="'rotate-' + field.name"
									[checked]="resetting(field)"
									[disabled]="disabled()"
									(checkedChange)="setReset(field, $event)"
								>
									{{ 'INBOX.SETTINGS.FORM.ROTATE' | translate }}
								</nb-checkbox>
							}
						}
						@case ('secret') {
							<input
								nbInput
								fullWidth
								fieldSize="small"
								type="password"
								autocomplete="new-password"
								spellcheck="false"
								[attr.data-test]="'input-' + field.name"
								[attr.id]="inputId(field)"
								[attr.maxlength]="field.property.maxLength ?? null"
								[placeholder]="
									(isSet(field)
										? 'INBOX.SETTINGS.FORM.SECRET_KEEP'
										: 'INBOX.SETTINGS.FORM.SECRET_ENTER'
									) | translate
								"
								[disabled]="disabled() || resetting(field)"
								[ngModel]="value(field)"
								[ngModelOptions]="standalone"
								(ngModelChange)="set(field, $event)"
							/>
							@if (isSet(field) && !field.required) {
								<nb-checkbox
									[attr.data-test]="'clear-' + field.name"
									[checked]="resetting(field)"
									[disabled]="disabled()"
									(checkedChange)="setReset(field, $event)"
								>
									{{ 'INBOX.SETTINGS.FORM.CLEAR_SECRET' | translate }}
								</nb-checkbox>
							}
						}
						@default {
							<input
								nbInput
								fullWidth
								fieldSize="small"
								[type]="field.inputType"
								[attr.data-test]="'input-' + field.name"
								[attr.id]="inputId(field)"
								[attr.min]="field.property.minimum ?? null"
								[attr.max]="field.property.maximum ?? null"
								[attr.step]="field.property.type === 'integer' ? 1 : null"
								[attr.maxlength]="field.property.maxLength ?? null"
								[disabled]="disabled()"
								[ngModel]="value(field)"
								[ngModelOptions]="standalone"
								(ngModelChange)="set(field, $event)"
							/>
						}
					}
					@if (field.description) {
						<p class="hint">{{ field.description }}</p>
					}
					@if (errors()[field.name]; as error) {
						<p class="error" role="alert" [attr.data-test]="'error-' + field.name">
							{{ error.key | translate: error.params }}
						</p>
					}
				</div>
			} @empty {
				<p class="hint" data-test="no-fields">{{ 'INBOX.SETTINGS.FORM.NO_FIELDS' | translate }}</p>
			}
		</div>
	`,
	styles: [
		`
			.field {
				margin-bottom: 0.9rem;
			}
			.label {
				display: flex;
				align-items: center;
				gap: 0.35rem;
				margin-bottom: 0.25rem;
				font-weight: 600;
			}
			.required {
				color: var(--text-danger-color, #ff3d71);
			}
			.chip {
				padding: 0 0.4rem;
				border: 1px solid var(--border-basic-color-4, #c5cee0);
				border-radius: 0.6rem;
				font-size: 0.7rem;
				font-weight: 500;
			}
			.chip-success {
				border-color: var(--color-success-default, #00d68f);
				color: var(--text-success-color, #00b887);
			}
			.hint {
				margin: 0.25rem 0 0;
				font-size: 0.8rem;
				opacity: 0.75;
			}
			.error {
				margin: 0.25rem 0 0;
				font-size: 0.8rem;
				color: var(--text-danger-color, #ff3d71);
			}
			nb-checkbox {
				display: block;
				margin-top: 0.35rem;
			}
		`
	]
})
export class InboxProviderConfigFormComponent {
	/** The provider plugin's form. */
	readonly schema = input<IEmailProviderConfigSchema | null>(null);
	/** The stored account of an edit (which secrets are set); `null` for a new account. */
	readonly account = input<IInboxProviderAccount | null>(null);
	/** The problems to show, by field (the caller decides when: after a first attempt to save). */
	readonly errors = input<Record<string, IProviderConfigError>>({});
	readonly disabled = input(false);
	/** Field ids are made unique per form with this prefix. */
	readonly idPrefix = input('inbox-provider-config');
	/** The values typed and the secrets to reset. */
	readonly state = model.required<IProviderConfigFormState>();

	readonly fields = computed(() => providerConfigFields(this.schema()));

	/** One stable object: `ngModel` outside a `<form>`. */
	protected readonly standalone = { standalone: true };

	value(field: IProviderConfigField): string | number | boolean | null {
		return this.state().values[field.name] ?? null;
	}

	set(field: IProviderConfigField, value: string | number | boolean | null): void {
		const state = this.state();
		this.state.set({ ...state, values: { ...state.values, [field.name]: value } });
	}

	isSet(field: IProviderConfigField): boolean {
		return isSecretSet(this.account(), field.name);
	}

	resetting(field: IProviderConfigField): boolean {
		return this.state().reset.includes(field.name);
	}

	/** Marks a secret to be cleared (`writeOnly`) or generated anew (`generated`) when saved; a typed value is dropped. */
	setReset(field: IProviderConfigField, on: boolean): void {
		const state = this.state();
		const reset = state.reset.filter((name) => name !== field.name);
		this.state.set({
			values: on ? { ...state.values, [field.name]: '' } : state.values,
			reset: on ? [...reset, field.name] : reset
		});
	}

	inputId(field: IProviderConfigField): string {
		return `${this.idPrefix()}-${field.name}`;
	}
}
