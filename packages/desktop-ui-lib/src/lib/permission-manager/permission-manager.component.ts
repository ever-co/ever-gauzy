import { Component, input, OnInit, OnDestroy, Optional, ChangeDetectionStrategy, signal } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbAlertModule,
	NbSpinnerModule,
	NbDialogRef
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { PermissionManagerService } from './permission-manager.service';
import { take, filter } from 'rxjs';

@UntilDestroy()
@Component({
	selector: 'ngx-permission-manager',
	templateUrl: './permission-manager.component.html',
	styleUrls: ['./permission-manager.component.scss'],
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbAlertModule,
		NbSpinnerModule,
		AsyncPipe,
		NgTemplateOutlet,
		TranslatePipe
	]
})
export class PermissionManagerComponent implements OnInit, OnDestroy {
	/** When true: renders as a dialog with Cancel/Start Anyway buttons */
	isDialog = input(false);
	timerStarted = input(false);

	// ── Screen Recording ──────────────────────────────────────────────────────
	public status$ = this.permissionService.status$;
	public isGranted$ = this.permissionService.isGranted$;
	public thumbnail: string | null = null;
	public activeWindow: {
		title?: string;
		appName?: string;
		bundleId?: string;
	};
	public testInProgress = false;
	public resetInProgress = false;
	public countdown: number | null = null;

	// ── Accessibility ─────────────────────────────────────────────────────────
	public accessibilityStatus$ = this.permissionService.accessibilityStatus$;
	public isAccessibilityGranted$ = this.permissionService.isAccessibilityGranted$;
	public accessibilityResetInProgress = false;
	public accessibilityCountdown: number | null = null;

	// ── Platform flags ───────────────────────────────────────────────────────
	readonly isMac = signal(false);
	readonly isWindows = signal(false);
	readonly hardwareAccelerationDisabled = signal(false);

	constructor(
		private readonly permissionService: PermissionManagerService,
		@Optional() private readonly dialogRef: NbDialogRef<PermissionManagerComponent>
	) {}

	ngOnInit() {
		// Always check on open
		this.permissionService.checkStatus();

		// Detect platform so the template can show/hide Mac-only controls
		this.platformSet();

		// Start polling — if screen recording granted while open, auto-close dialog
		this.startPolling();
	}

	async platformSet() {
		const platform = await this.permissionService.getPlatform();
		const hardwareAccelerationDisabled = await this.permissionService.getHardwareAccelerationState();
		this.isMac.set(platform?.os === 'darwin');
		this.isWindows.set(platform?.os === 'win32');
		this.hardwareAccelerationDisabled.set(hardwareAccelerationDisabled);
	}

	startPolling() {
		this.permissionService
			.startPolling()
			.pipe(
				filter((granted) => granted && this.isDialog()),
				take(1),
				untilDestroyed(this)
			)
			.subscribe(() => this.dialogRef?.close({ granted: true }));
	}

	// ── Screen Recording actions ──────────────────────────────────────────────

	async testScreenshot() {
		this.testInProgress = true;
		const result = await this.permissionService.testScreenshot();
		this.thumbnail = result.success ? result.thumbnail : null;
		this.testInProgress = false;
	}

	async testGetActiveWindow() {
		this.testInProgress = true;
		const result = await this.permissionService.testGetWindow();
		this.activeWindow = result.success ? (result.window ?? null) : null;
		this.testInProgress = false;
	}

	openSystemSettings() {
		this.permissionService.openSystemSettings();
	}

	async resetAndRelaunch() {
		this.resetInProgress = true;
		await this.permissionService.resetPermission();
		this.resetInProgress = false;
	}

	// ── Accessibility actions ─────────────────────────────────────────────────

	openAccessibilitySettings() {
		this.permissionService.openAccessibilitySettings();
	}

	async resetAccessibilityAndRelaunch() {
		this.accessibilityResetInProgress = true;
		await this.permissionService.resetAccessibilityPermission();
		this.accessibilityResetInProgress = false;
	}

	async relaunchApp() {
		if (this.timerStarted()) {
			return;
		}
		this.permissionService.relaunchApp();
	}

	async toggleHardwareAcceleration() {
		const newState = !this.hardwareAccelerationDisabled();
		await this.permissionService.setHardwareAcceleration(newState);
		this.hardwareAccelerationDisabled.set(newState);
	}

	// ── Dialog-only actions ───────────────────────────────────────────────────
	startAnyway() {
		this.dialogRef?.close({ startAnyway: true });
	}
	cancel() {
		this.dialogRef?.close({ cancelled: true });
	}

	ngOnDestroy() {
		this.permissionService.stopPolling();
	}
}
