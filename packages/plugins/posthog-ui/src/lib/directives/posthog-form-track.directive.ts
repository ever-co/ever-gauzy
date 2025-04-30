import {
	Directive,
	Input,
	OnInit,
	ElementRef,
	Renderer2,
	HostListener,
	Inject,
	Optional,
	OnDestroy
} from '@angular/core';
import { PostHogServiceManager } from '../services/posthog-manager.service';
import { POSTHOG_DEBUG_MODE } from '../interfaces/posthog.interface';
import { NgForm } from '@angular/forms';

/**
 * Directive to automatically track form submissions and field interactions with PostHog
 *
 * Usage:
 * <form
 *   phFormTrack
 *   [phFormName]="'signup_form'"
 *   [phTrackFields]="true"
 *   [phExcludeFields]="['password', 'credit-card']"
 *   [phSanitizeValues]="true"
 *   (ngSubmit)="onSubmit()"
 * >
 *   <input name="email" type="email">
 *   <input name="password" type="password">
 *   <button type="submit">Submit</button>
 * </form>
 */
@Directive({
	selector: 'form[phFormTrack]',
	standalone: true
})
export class PostHogFormTrackDirective implements OnInit, OnDestroy {
	@Input() phFormName = 'form';
	@Input() phTrackFields = false;
	@Input() phExcludeFields: (string | RegExp)[] = ['password', 'secret', 'token', 'credit', 'card'];
	@Input() phSanitizeValues = true;
	@Input() phTrackFocus = false;
	@Input() phTrackBlur = false;
	@Input() phTrackChange = true;
	@Input() phIncludeMetadata = true;
	@Input() phFieldPrefix = ''; // Prefix for tracking field interactions

	// Field interaction listeners
	private fieldListeners: (() => void)[] = [];

	constructor(
		private posthogServiceManager: PostHogServiceManager,
		private elementRef: ElementRef<HTMLFormElement>,
		private renderer: Renderer2,
		@Optional() private ngForm?: NgForm,
		@Optional() @Inject(POSTHOG_DEBUG_MODE) private debugMode = false
	) {}

	ngOnInit(): void {
		// Setup field tracking if enabled
		if (this.phTrackFields) {
			this.setupFieldTracking();
		}

		// Track form viewed event
		try {
			this.posthogServiceManager.trackEvent(`form_viewed`, {
				form_name: this.phFormName,
				form_id: this.elementRef.nativeElement.id || undefined,
				form_action: this.elementRef.nativeElement.action || undefined,
				form_fields: this.getFieldNames()
			});
		} catch (err) {
			if (this.debugMode) {
				console.warn('[PostHog] Skipped form_viewed event – service not ready', err);
			}
		}
	}

	@HostListener('submit', ['$event'])
	onSubmit(event: Event): void {
		const formData = this.getFormData();

		this.posthogServiceManager.trackEvent(`form_submitted`, {
			form_name: this.phFormName,
			form_id: this.elementRef.nativeElement.id || undefined,
			form_action: this.elementRef.nativeElement.action || undefined,
			form_valid: this.ngForm?.valid ?? this.elementRef.nativeElement.checkValidity?.() ?? true,
			...formData
		});

		if (this.debugMode) {
			console.debug(`[PostHog] Form submitted: ${this.phFormName}`, formData);
		}
	}

	ngOnDestroy(): void {
		// Cleanup all event listeners
		this.fieldListeners.forEach((removeListener) => removeListener());
	}

	/**
	 * Setup tracking for individual form fields
	 */
	private setupFieldTracking(): void {
		const formElement = this.elementRef.nativeElement;
		const fields = Array.from(formElement.elements) as HTMLElement[];

		fields.forEach((field: HTMLElement) => {
			if (
				!(
					field instanceof HTMLInputElement ||
					field instanceof HTMLSelectElement ||
					field instanceof HTMLTextAreaElement
				)
			) {
				return;
			}

			const fieldName = (field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).name;
			if (!fieldName || this.shouldExcludeField(fieldName)) return;

			// Track focus events
			if (this.phTrackFocus) {
				const focusListener = this.renderer.listen(field, 'focus', () => {
					this.trackFieldInteraction('field_focus', field);
				});
				this.fieldListeners.push(focusListener);
			}

			// Track blur events
			if (this.phTrackBlur) {
				const blurListener = this.renderer.listen(field, 'blur', () => {
					this.trackFieldInteraction('field_blur', field);
				});
				this.fieldListeners.push(blurListener);
			}

			// Track change events
			if (this.phTrackChange) {
				const changeListener = this.renderer.listen(field, 'change', () => {
					this.trackFieldInteraction('field_change', field);
				});
				this.fieldListeners.push(changeListener);
			}
		});
	}

	/**
	 * Track a field interaction
	 */
	private trackFieldInteraction(eventType: string, field: HTMLElement): void {
		if (
			!(
				field instanceof HTMLInputElement ||
				field instanceof HTMLSelectElement ||
				field instanceof HTMLTextAreaElement
			)
		) {
			return;
		}

		const fieldName = field.name;
		if (this.shouldExcludeField(fieldName)) return;

		const eventName = this.phFieldPrefix ? `${this.phFieldPrefix}_${eventType}` : eventType;

		let value: string | boolean | string[] | undefined = undefined;

		// Only include value for certain field types and if sanitization is allowed
		if (!this.shouldRedactFieldValue(fieldName, field.type)) {
			if (field instanceof HTMLInputElement && field.type === 'checkbox') {
				value = field.checked;
			} else if (field instanceof HTMLInputElement && field.type === 'radio') {
				if (field.checked) {
					value = field.value;
				}
			} else if (field instanceof HTMLSelectElement && field.multiple) {
				value = Array.from(field.selectedOptions).map((option) => option.value);
			} else {
				value = this.sanitizeFieldValue(field.value);
			}
		}

		const properties: Record<string, any> = {
			form_name: this.phFormName,
			field_name: fieldName,
			field_type: field.type
		};

		// Only add value if it exists and should be included
		if (value !== undefined) {
			properties['field_value'] = value;
		}

		// Add metadata if configured
		if (this.phIncludeMetadata) {
			properties['field_id'] = field.id || undefined;
			properties['field_required'] = field.required || false;

			if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
				properties['field_max_length'] = field.maxLength > 0 ? field.maxLength : undefined;
			}
		}

		this.posthogServiceManager.trackEvent(eventName, properties);
	}

	/**
	 * Get all form data, sanitizing sensitive fields
	 */
	private getFormData(): Record<string, any> {
		const formData: Record<string, any> = {};
		const formElement = this.elementRef.nativeElement;
		const formFields = Array.from(formElement.elements) as HTMLElement[];

		formFields.forEach((field: HTMLElement) => {
			if (
				!(
					field instanceof HTMLInputElement ||
					field instanceof HTMLSelectElement ||
					field instanceof HTMLTextAreaElement
				)
			) {
				return;
			}

			const fieldName = field.name;
			if (!fieldName) return;

			if (this.shouldExcludeField(fieldName)) {
				formData[`field_${fieldName}_included`] = false;
				return;
			}

			if (field instanceof HTMLInputElement && field.type === 'checkbox') {
				formData[`field_${fieldName}`] = field.checked;
			} else if (field instanceof HTMLInputElement && field.type === 'radio') {
				if (field.checked) {
					formData[`field_${fieldName}`] = field.value;
				}
			} else if (field instanceof HTMLSelectElement && field.multiple) {
				formData[`field_${fieldName}`] = Array.from(field.selectedOptions).map((option) => option.value);
			} else if (this.shouldRedactFieldValue(fieldName, field.type)) {
				formData[`field_${fieldName}`] = '[REDACTED]';
			} else {
				formData[`field_${fieldName}`] = this.sanitizeFieldValue(field.value);
			}
		});

		return formData;
	}

	/**
	 * Get an array of field names in the form
	 */
	private getFieldNames(): string[] {
		const formElement = this.elementRef.nativeElement;
		const formFields = Array.from(formElement.elements) as HTMLElement[];
		const fieldNames: string[] = [];

		formFields.forEach((field: HTMLElement) => {
			if (
				!(
					field instanceof HTMLInputElement ||
					field instanceof HTMLSelectElement ||
					field instanceof HTMLTextAreaElement
				)
			) {
				return;
			}

			const fieldName = field.name;
			if (fieldName) {
				fieldNames.push(fieldName);
			}
		});

		return fieldNames;
	}

	/**
	 * Check if a field should be excluded from tracking
	 */
	private shouldExcludeField(fieldName: string): boolean {
		return this.phExcludeFields.some((pattern) => {
			if (typeof pattern === 'object' && pattern instanceof RegExp) {
				return pattern.test(fieldName);
			}
			if (typeof pattern === 'string') {
				return fieldName.toLowerCase().includes(pattern.toLowerCase());
			}
			return false;
		});
	}

	/**
	 * Check if a field value should be redacted
	 */
	private shouldRedactFieldValue(fieldName: string, fieldType: string): boolean {
		// Always redact password fields
		if (fieldType === 'password') return true;

		// Check field name against sensitive patterns
		const sensitivePatterns = [
			'password',
			'secret',
			'token',
			'auth',
			'key',
			'credit',
			'card',
			'cvv',
			'ssn',
			'social'
		];
		return sensitivePatterns.some((pattern) => fieldName.toLowerCase().includes(pattern));
	}

	/**
	 * Sanitize a field value for tracking
	 */
	private sanitizeFieldValue(value: string): string {
		if (!this.phSanitizeValues) return value;

		// Truncate long values
		if (value && value.length > 100) {
			return `${value.substring(0, 97)}...`;
		}

		return value;
	}
}
