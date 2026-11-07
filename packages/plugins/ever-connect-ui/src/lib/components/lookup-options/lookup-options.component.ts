import { HttpErrorResponse } from '@angular/common/http';
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	DestroyRef,
	EventEmitter,
	inject,
	Input,
	Output
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbToggleModule } from '@nebular/theme';
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
				[checked]="autoCheck"
				[disabled]="!canEdit || busy"
				(checkedChange)="set($event)"
			>
				{{ 'EVER_CONNECT.LOOKUP.AUTO_CHECK' | translate }}
			</nb-toggle>
			<p class="hint">{{ 'EVER_CONNECT.LOOKUP.AUTO_CHECK_HINT' | translate }}</p>
			@if (failed) {
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
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	@Input({ required: true }) organizationId!: string;
	@Input() autoCheck = false;
	/** `INTEGRATION_EDIT`: the toggle can be changed. */
	@Input() canEdit = false;
	@Output() readonly autoCheckChange = new EventEmitter<boolean>();

	busy = false;
	failed = false;

	set(value: boolean): void {
		if (!this.canEdit || this.busy || value === this.autoCheck) return;
		const before = this.autoCheck;
		// The toggle shows the value asked for while it is saved, and the saved one after.
		this.autoCheck = value;
		this.busy = true;
		this.failed = false;
		this.api
			.setLookupAutoCheck(this.organizationId, value)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: ({ auto_check }) => {
					this.autoCheck = auto_check;
					this.busy = false;
					this.autoCheckChange.emit(auto_check);
					this.cdr.markForCheck();
				},
				error: (_error: HttpErrorResponse) => {
					// Not saved: the toggle goes back to the saved value, and a new click is taken.
					this.autoCheck = before;
					this.busy = false;
					this.failed = true;
					this.cdr.markForCheck();
				}
			});
	}
}
