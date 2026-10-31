import { AbstractControl } from '@angular/forms';
import { MonoTypeOperatorFunction, Subscription, filter } from 'rxjs';
import {
	IAgentRestrictionLocation,
	IScreenshotCaptureAcknowledgement,
	IScreenshotCaptureSettingInput,
	requiresScreenshotCaptureAcknowledgement
} from '@gauzy/contracts';

/**
 * Asks the admin for the screen capture acknowledgement: resolves to the statements they confirmed, or to `null`
 * when they cancel. The caller decides how to ask (the organization settings page opens a dialog).
 */
export type AskForScreenshotCaptureAcknowledgement = () => Promise<IScreenshotCaptureAcknowledgement | null>;

export interface IScreenshotCaptureAcknowledgementPromptOptions {
	/** The `allowScreenshotCapture` toggle of the form. */
	control: () => AbstractControl | null | undefined;
	/** The organization as stored (none while it is being created). */
	persisted: () => Pick<IScreenshotCaptureSettingInput, 'allowScreenshotCapture'> | null | undefined;
	/** Where the organization is, with the form's pending changes applied. */
	location: () => IAgentRestrictionLocation | IAgentRestrictionLocation[];
	/** How to ask. */
	ask: AskForScreenshotCaptureAcknowledgement;
}

/**
 * Issue #9872 — turning screen capture on for an organization in the EEA or the UK takes the admin's explicit
 * acknowledgement (lawful basis, employee notice, works council process), which the API records against them.
 *
 * This keeps the form in step with that rule, which it reads from `@gauzy/contracts` like the API does:
 * - switching the toggle on asks right away; cancelling switches it back off;
 * - saving asks again when the acknowledgement is still needed (the location changed after the toggle, say);
 * - switching the toggle off forgets the acknowledgement, so switching it on again asks again;
 * - an organization that already captures, or one outside the EEA and the UK, is never asked.
 *
 * The form sends {@link payload} with its save, and calls {@link reset} once saved or reloaded.
 */
export class ScreenshotCaptureAcknowledgementPrompt {
	private acknowledgement: IScreenshotCaptureAcknowledgement | null = null;
	private asking: Promise<boolean> | null = null;

	constructor(private readonly options: IScreenshotCaptureAcknowledgementPromptOptions) {}

	/** Whether the toggle as it stands turns capture on where the acknowledgement is required. */
	get required(): boolean {
		const control = this.options.control();
		if (!control) return false;
		return requiresScreenshotCaptureAcknowledgement(
			{ allowScreenshotCapture: control.value === true },
			this.options.persisted() ?? null,
			this.options.location()
		);
	}

	/** Whether the save may go ahead without asking. */
	get satisfied(): boolean {
		return !this.required || this.acknowledgement !== null;
	}

	/** What the save sends with the settings: the acknowledgement, when this change needs it. */
	get payload(): Pick<IScreenshotCaptureSettingInput, 'screenshotCaptureAcknowledgement'> {
		return this.required && this.acknowledgement
			? { screenshotCaptureAcknowledgement: { ...this.acknowledgement } }
			: {};
	}

	/**
	 * Asks when the toggle is switched on and the acknowledgement is required, and forgets it when the toggle is
	 * switched off. Unsubscribe with the component (`untilDestroyed(this)`).
	 */
	bind(untilDestroyedPipe: MonoTypeOperatorFunction<boolean>): Subscription | undefined {
		const control = this.options.control();
		if (!control) return undefined;

		return control.valueChanges
			.pipe(
				filter((value): value is boolean => typeof value === 'boolean'),
				untilDestroyedPipe
			)
			.subscribe((value) => {
				if (value) {
					void this.confirm();
				} else {
					this.acknowledgement = null;
				}
			});
	}

	/**
	 * Makes sure the change can be saved: asks when the acknowledgement is required and not given yet. When the
	 * admin cancels, the toggle is switched back off and this resolves to `false`; the caller may still save the
	 * other settings, with capture off.
	 */
	confirm(): Promise<boolean> {
		if (this.satisfied) return Promise.resolve(true);
		// One question at a time: the toggle and the save button can both ask.
		this.asking ??= this.options
			.ask()
			.catch(() => null)
			.then((given) => this.settle(given))
			.finally(() => (this.asking = null));
		return this.asking;
	}

	/** Forgets the acknowledgement: after a save, or when the organization is reloaded. */
	reset(): void {
		this.acknowledgement = null;
	}

	private settle(given: IScreenshotCaptureAcknowledgement | null): boolean {
		const complete =
			!!given && given.lawfulBasis === true && given.employeeNotice === true && given.worksCouncil === true;
		if (complete) {
			this.acknowledgement = { lawfulBasis: true, employeeNotice: true, worksCouncil: true };
			return true;
		}
		this.acknowledgement = null;
		this.options.control()?.setValue(false, { emitEvent: false });
		return false;
	}
}
