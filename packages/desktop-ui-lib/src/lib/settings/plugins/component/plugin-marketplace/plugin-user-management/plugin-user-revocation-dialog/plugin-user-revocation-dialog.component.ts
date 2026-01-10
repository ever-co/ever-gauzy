import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IUser } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PluginSubscriptionAccessFacade } from '../../+state/plugin-subscription-access.facade';

@Component({
	selector: 'gauzy-plugin-user-revocation-dialog',
	templateUrl: './plugin-user-revocation-dialog.component.html',
	styleUrls: ['./plugin-user-revocation-dialog.component.scss'],
	standalone: false
})
export class PluginUserRevocationDialogComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();

	form: FormGroup;
	pluginId: string;
	userIds: string[];
	usersToRevoke: IUser[] = [];

	// Observables from facade
	loading$ = this.accessFacade.loading$;
	error$ = this.accessFacade.error$;

	constructor(
		private readonly dialogRef: NbDialogRef<PluginUserRevocationDialogComponent>,
		private readonly fb: FormBuilder,
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly translateService: TranslateService
	) {
		this.buildForm();
	}

	ngOnInit(): void {
		// Watch for successful revocation
		this.accessFacade.revocationDialogOpen$.pipe(takeUntil(this.destroy$)).subscribe((isOpen) => {
			if (!isOpen) {
				// Dialog closed by effects after successful revocation
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
			revocationReason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]]
		});
	}

	revokeUsers(): void {
		if (this.form.invalid || !this.pluginId || !this.userIds?.length) {
			this.form.markAllAsTouched();
			return;
		}

		const { revocationReason } = this.form.value;
		this.accessFacade.revokeUsers(this.pluginId, this.userIds, revocationReason);
	}

	close(): void {
		this.accessFacade.hideRevocationDialog();
		this.dialogRef.close(false);
	}

	get userCount(): number {
		return this.userIds?.length || 0;
	}

	get isValid(): boolean {
		return this.form.valid && this.userIds?.length > 0;
	}

	getUserNames(): string {
		return this.usersToRevoke
			.map((user) => user.name || user.email)
			.filter(Boolean)
			.join(', ');
	}
}
