import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	inject,
	input,
	linkedSignal,
	output,
	signal,
	viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbToggleComponent, NbToggleModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EverConnectUiService } from '../../services/ever-connect.service';

/**
 * The counterparty check's own setting on its row of Integrations & data: "check a contact when it
 * is opened". Off by default; part of what the organization consented to in app.ever.co. Only an
 * administrator who may change integrations (`INTEGRATION_EDIT`) can turn it on.
 */
@Component({
	selector: 'ngx-ever-connect-lookup-options',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbToggleModule, TranslatePipe],
	template: `
		<div class="lookup-options" data-test="lookup-options">
			<nb-toggle
				data-test="auto-check"
				[checked]="saved()"
				[disabled]="!canEdit() || busy()"
				(checkedChange)="set($event)"
			>
				{{ 'EVER_CONNECT.LOOKUP.AUTO_CHECK' | translate }}
			</nb-toggle>
			<p class="hint">{{ 'EVER_CONNECT.LOOKUP.AUTO_CHECK_HINT' | translate }}</p>
			@if (failed()) {
				<p class="hint" data-test="auto-check-failed">
					{{ 'EVER_CONNECT.LOOKUP.AUTO_CHECK_FAILED' | translate }}
				</p>
			}
		</div>
	`,
	styles: [
		`
			.lookup-options {
				margin-top: 0.5rem;
			}
			.hint {
				font-size: 0.8125rem;
				opacity: 0.8;
				margin: 0.25rem 0 0;
			}
		`
	]
})
export class LookupOptionsComponent {
	private readonly api = inject(EverConnectUiService);
	private readonly destroyRef = inject(DestroyRef);

	readonly organizationId = input.required<string>();
	/** The saved value of the setting, as the integrations list read it. */
	readonly autoCheck = input(false);
	/** `INTEGRATION_EDIT`: the toggle can be changed. */
	readonly canEdit = input(false);
	/** The value the API saved, after each save that went through. */
	readonly autoCheckChange = output<boolean>();

	/** The last value the API confirmed: the input's, until a save goes through. */
	protected readonly saved = linkedSignal(() => this.autoCheck());
	protected readonly busy = signal(false);
	protected readonly failed = signal(false);

	private readonly toggle = viewChild.required(NbToggleComponent);
	private readonly toggleElement = viewChild.required(NbToggleComponent, { read: ElementRef });

	/** A click on the toggle: the value it asks for is saved; until the API answers, the toggle shows it. */
	protected set(value: boolean): void {
		const before = this.saved();
		if (!this.canEdit() || this.busy() || value === before) return;
		this.busy.set(true);
		this.failed.set(false);
		this.api
			.setLookupAutoCheck(this.organizationId(), value)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: ({ auto_check }) => {
					this.busy.set(false);
					this.saved.set(auto_check);
					this.show(auto_check);
					this.autoCheckChange.emit(auto_check);
				},
				error: () => {
					// Not saved: the toggle goes back to the last saved value, so the next click is taken.
					this.busy.set(false);
					this.failed.set(true);
					this.show(before);
				}
			});
	}

	/**
	 * Makes the toggle show `value`. The click already changed the native checkbox and the toggle's
	 * own state, and a binding whose value did not change (a save that failed, at once or later)
	 * writes neither back, so both are set here.
	 */
	private show(value: boolean): void {
		this.toggle().writeValue(value);
		const checkbox = (this.toggleElement().nativeElement as HTMLElement).querySelector<HTMLInputElement>(
			'input[type="checkbox"]'
		);
		if (checkbox) checkbox.checked = value;
	}
}
