import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { WidgetConfigField } from '@gauzy/ui-core/core';

/** Shared fallback so `@for` never re-diffs on a fresh empty array. */
const NO_OPTIONS: NonNullable<WidgetConfigField['options']> = [];

/**
 * Per-widget settings dialog of the dashboard builder.
 *
 * Rendered from a widget's declared `configSchema`, so a widget gains settings by
 * declaring them in the registry — no dialog change needed. The result is the
 * placement's new `config` object, which the page hands to
 * `DashboardCanvasComponent.applyConfig()`.
 *
 * The caller passes only the fields the dialog can render (see
 * `renderableConfigFields` in `@gauzy/ui-core/shared`); values of fields it
 * cannot render are carried over untouched from {@link config}, so opening the
 * dialog never destroys settings written by something else.
 */
@Component({
	selector: 'ga-widget-config-dialog',
	templateUrl: './widget-config-dialog.component.html',
	styleUrls: ['./widget-config-dialog.component.scss'],
	standalone: false
})
export class WidgetConfigDialogComponent implements OnInit {
	/** Widget name shown in the dialog header. May be a translation key. */
	@Input() public widgetTitle = '';

	/** The renderable subset of the widget's `configSchema`. */
	@Input() public fields: WidgetConfigField[] = [];

	/** The placement's current configuration. */
	@Input() public config: Record<string, unknown> = {};

	/** One control per rendered field, keyed by `WidgetConfigField.key`. */
	public form: UntypedFormGroup;

	constructor(
		private readonly _dialogRef: NbDialogRef<WidgetConfigDialogComponent>,
		private readonly _fb: UntypedFormBuilder
	) {}

	ngOnInit(): void {
		const controls: Record<string, unknown[]> = {};
		for (const field of this.fields ?? []) {
			controls[field.key] = [this._initialValue(field)];
		}
		this.form = this._fb.group(controls);
	}

	/**
	 * Options of a `select` field.
	 *
	 * @param field - The field being rendered.
	 * @returns Its options, or a shared empty list for a malformed schema.
	 */
	public optionsOf(field: WidgetConfigField): NonNullable<WidgetConfigField['options']> {
		return field.options ?? NO_OPTIONS;
	}

	/** Closes without applying anything. */
	public close(): void {
		this._dialogRef.close();
	}

	/**
	 * Closes with the new configuration.
	 *
	 * Starts from the placement's existing configuration rather than from an empty
	 * object: the schema is only a view onto `config`, and the canvas REPLACES the
	 * whole object, so building it from scratch would drop every key the dialog
	 * does not render.
	 */
	public submit(): void {
		const raw = this.form?.getRawValue() ?? {};
		const next: Record<string, unknown> = { ...this.config };

		for (const field of this.fields ?? []) {
			const value = this._normalize(field, raw[field.key]);
			if (value === undefined) {
				// Cleared: drop the key so the widget falls back to its own default
				// instead of persisting an empty string as a meaningful value.
				delete next[field.key];
			} else {
				next[field.key] = value;
			}
		}

		this._dialogRef.close(next);
	}

	/** Seeds a control from the saved value, falling back to the field's default. */
	private _initialValue(field: WidgetConfigField): unknown {
		const saved = this.config?.[field.key];
		const value = saved ?? field.default;
		if (field.type === 'boolean') {
			return value === true;
		}
		return value ?? null;
	}

	/**
	 * Converts a control value into what gets persisted.
	 *
	 * @returns The value to store, or `undefined` when the field is empty.
	 */
	private _normalize(field: WidgetConfigField, value: unknown): unknown {
		if (field.type === 'boolean') {
			return value === true;
		}
		if (field.type === 'number') {
			// `Number('')` is 0, which would silently persist a value the user cleared.
			const parsed = value === '' || value === null || value === undefined ? NaN : Number(value);
			return Number.isFinite(parsed) ? parsed : undefined;
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed.length ? trimmed : undefined;
		}
		return value ?? undefined;
	}
}
