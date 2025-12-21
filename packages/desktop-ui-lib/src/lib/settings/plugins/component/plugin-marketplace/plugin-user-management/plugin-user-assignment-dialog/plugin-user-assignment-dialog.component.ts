import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IUser } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Subject, takeUntil } from 'rxjs';
import { PluginSubscriptionAccessFacade } from '../../+state/plugin-subscription-access.facade';

@Component({
	selector: 'gauzy-plugin-user-assignment-dialog',
	templateUrl: './plugin-user-assignment-dialog.component.html',
	styleUrls: ['./plugin-user-assignment-dialog.component.scss'],
	standalone: false
})
export class PluginUserAssignmentDialogComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();

	form: FormGroup;
	pluginId: string;
	availableUsers: IUser[] = [];
	loadingUsers = false;

	// Observables from facade
	loading$ = this.accessFacade.loading$;
	error$ = this.accessFacade.error$;

	constructor(
		private readonly dialogRef: NbDialogRef<PluginUserAssignmentDialogComponent>,
		private readonly fb: FormBuilder,
		private readonly accessFacade: PluginSubscriptionAccessFacade
	) {
		this.buildForm();
	}

	ngOnInit(): void {
		// Watch for successful assignment
		this.accessFacade.assignmentDialogOpen$.pipe(takeUntil(this.destroy$)).subscribe((isOpen) => {
			if (!isOpen) {
				// Dialog closed by effects after successful assignment
				this.dialogRef.close(true);
			}
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private buildForm(): void {
		this.form = this.fb.group({
			userIds: [[], [Validators.required, Validators.minLength(1)]],
			reason: ['', [Validators.maxLength(500)]]
		});
	}

	assignUsers(): void {
		if (this.form.invalid || !this.pluginId) {
			this.form.markAllAsTouched();
			return;
		}

		const { userIds, reason } = this.form.value;
		this.accessFacade.assignUsers(this.pluginId, userIds, reason);
	}

	close(): void {
		this.accessFacade.hideAssignmentDialog();
		this.dialogRef.close(false);
	}

	get selectedCount(): number {
		return this.form.get('userIds')?.value?.length || 0;
	}

	get isValid(): boolean {
		return this.form.valid && this.selectedCount > 0;
	}
}
