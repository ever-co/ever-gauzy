import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbAlertModule, NbButtonModule, NbCheckboxModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import type { EverWorksDirection, EverWorksMapping } from '../../services/ever-works.service';
import { EVER_WORKS_DOMAINS, EverWorksUiService } from '../../services/ever-works.service';
import { errorText } from '../shared/ever-works-ui.utils';

/**
 * Entities and directions of a mapping (plan 02 §1 defaults; plan 06 G-P1-11): one direction per synced
 * domain, limited to the directions that domain allows, and whether tasks of projects not paired with a
 * work sync too. Used by the connect wizard and the settings page.
 */
@Component({
	selector: 'ngx-ever-works-directions',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbAlertModule, NbButtonModule, NbCheckboxModule, TranslatePipe],
	template: `
		<p>{{ 'EVER_WORKS.DIRECTIONS.INTRO' | translate }}</p>
		@if (error) {
			<nb-alert status="danger" role="alert" data-test="directions-error">{{ error }}</nb-alert>
		}
		@if (saved) {
			<nb-alert status="success" role="status" data-test="directions-saved">{{ 'EVER_WORKS.COMMON.SAVED' | translate }}</nb-alert>
		}
		<table class="table" data-test="directions">
			<thead>
				<tr>
					<th>{{ 'EVER_WORKS.DIRECTIONS.DOMAIN' | translate }}</th>
					<th>{{ 'EVER_WORKS.DIRECTIONS.DIRECTION' | translate }}</th>
				</tr>
			</thead>
			<tbody>
				@for (domain of domains; track domain) {
					<tr>
						<td>{{ 'EVER_WORKS.DOMAINS.' + domain | translate }}</td>
						<td>
							<select
								class="form-control"
								[attr.data-test]="'direction-' + domain"
								[name]="'direction-' + domain"
								[(ngModel)]="directions[domain]"
								[disabled]="busy || readonly"
								(ngModelChange)="saved = false"
							>
								@for (option of allowed(domain); track option) {
									<option [ngValue]="option">{{ 'EVER_WORKS.DIRECTIONS.VALUES.' + option | translate }}</option>
								}
							</select>
						</td>
					</tr>
				}
			</tbody>
		</table>
		<nb-checkbox
			data-test="sync-unlinked"
			name="syncUnlinkedProjectTasks"
			[(ngModel)]="syncUnlinkedProjectTasks"
			[disabled]="busy || readonly"
			(ngModelChange)="saved = false"
		>
			{{ 'EVER_WORKS.DIRECTIONS.SYNC_UNLINKED_PROJECT_TASKS' | translate }}
		</nb-checkbox>
		@if (!readonly) {
			<div class="actions">
				<button nbButton status="primary" type="button" data-test="save-directions" [disabled]="busy" (click)="save()">
					{{ (saveLabel || 'EVER_WORKS.COMMON.SAVE') | translate }}
				</button>
			</div>
		}
	`,
	styles: [
		`
			.actions {
				margin-top: 1rem;
			}
		`
	]
})
export class EverWorksDirectionsComponent implements OnChanges {
	private readonly api = inject(EverWorksUiService);
	private readonly cdr = inject(ChangeDetectorRef);

	@Input() organizationId: string | null = null;
	@Input() mapping: EverWorksMapping | null = null;
	@Input() readonly = false;
	/** The label of the save button (the wizard says "Next"). */
	@Input() saveLabel: string | null = null;
	@Output() readonly savedMapping = new EventEmitter<EverWorksMapping>();

	readonly domains = Object.keys(EVER_WORKS_DOMAINS);
	directions: Record<string, EverWorksDirection> = {};
	syncUnlinkedProjectTasks = true;
	busy = false;
	saved = false;
	error: string | null = null;

	ngOnChanges(): void {
		// A fresh copy: nothing changes on the mapping until it is saved.
		this.directions = { ...(this.mapping?.directions ?? {}) };
		for (const domain of this.domains) {
			if (!this.allowed(domain).includes(this.directions[domain])) this.directions[domain] = this.allowed(domain)[0];
		}
		this.syncUnlinkedProjectTasks = this.mapping?.syncUnlinkedProjectTasks ?? true;
		this.saved = false;
		this.error = null;
	}

	allowed(domain: string): ReadonlyArray<EverWorksDirection> {
		return EVER_WORKS_DOMAINS[domain] ?? ['off'];
	}

	save(): void {
		if (!this.mapping) return;
		this.busy = true;
		this.error = null;
		// Only directions the domain allows are sent (the API refuses anything else).
		const directions = Object.fromEntries(this.domains.filter((domain) => this.allowed(domain).includes(this.directions[domain])).map((domain) => [domain, this.directions[domain]]));
		this.api
			.updateMapping(this.organizationId, this.mapping.integrationTenantId, { directions, syncUnlinkedProjectTasks: this.syncUnlinkedProjectTasks })
			.subscribe({
				next: (mapping) => {
					this.busy = false;
					this.saved = true;
					this.mapping = mapping;
					this.savedMapping.emit(mapping);
					this.cdr.markForCheck();
				},
				error: (error) => {
					this.busy = false;
					this.error = errorText(error);
					this.cdr.markForCheck();
				}
			});
	}
}
