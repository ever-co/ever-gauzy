import { Component, Input, OnInit, OnDestroy, Optional } from '@angular/core';
import {
	AsyncPipe,
} from '@angular/common';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbAlertModule,
	NbSpinnerModule,
	NbDialogRef
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	untilDestroyed
} from '@ngneat/until-destroy';
import { PermissionManagerService } from './permission-manager.service';
import { take, filter } from 'rxjs';
@Component({
    selector: 'ngx-permission-manager',
    templateUrl: './permission-manager.component.html',
    styleUrls: ['./permission-manager.component.scss'],
    standalone: true,
    imports: [
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbAlertModule,
		NbSpinnerModule,
		AsyncPipe,
		TranslatePipe
	]
})
export class PermissionManagerComponent implements OnInit, OnDestroy {
    /** When true: renders as a dialog with Cancel/Start Anyway buttons */
    @Input() isDialog = false;

    public status$ = this.permissionService.status$;
    public isGranted$ = this.permissionService.isGranted$;
    public thumbnail: string | null = null;
    public testInProgress = false;
    public resetInProgress = false;
    public countdown: number | null = null;

    constructor(
        private readonly permissionService: PermissionManagerService,
        @Optional() private readonly dialogRef: NbDialogRef<PermissionManagerComponent>
    ) {}

    ngOnInit() {
        // Always check on open
        this.permissionService.checkStatus();

        // Start polling — if granted while open, auto-close dialog
        this.permissionService.startPolling().pipe(
            filter(granted => granted && this.isDialog),
            take(1),
            untilDestroyed(this)
        ).subscribe(() => this.dialogRef?.close({ granted: true }));
    }

    async testScreenshot() {
        this.testInProgress = true;
        const result = await this.permissionService.testScreenshot();
        this.thumbnail = result.success ? result.thumbnail : null;
        this.testInProgress = false;
    }

    openSystemSettings() {
        this.permissionService.openSystemSettings();
    }

    async resetAndRelaunch() {
        this.resetInProgress = true;
        const result = await this.permissionService.resetPermission();
        if (result.success) {
            // Countdown 3s then relaunch
            this.countdown = 3;
            const timer = setInterval(() => {
                this.countdown--;
                if (this.countdown <= 0) {
                    clearInterval(timer);
                    this.permissionService.relaunchApp();
                }
            }, 1000);
        }
        this.resetInProgress = false;
    }

    // Dialog-only actions
    startAnyway() { this.dialogRef?.close({ startAnyway: true }); }
    cancel()      { this.dialogRef?.close({ cancelled: true }); }

    ngOnDestroy() {
        this.permissionService.stopPolling();
    }
}
