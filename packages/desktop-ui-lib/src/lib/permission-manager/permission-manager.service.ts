import {
	Injectable
} from '@angular/core';
import {
	BehaviorSubject,
	Subscription,
	map,
	Observable,
	switchMap,
	interval,
	distinctUntilChanged,
	from,
	tap
} from 'rxjs';
import { ElectronService } from '../electron/services';

type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

@Injectable({ providedIn: 'root' })
export class PermissionManagerService {
	private _status$ = new BehaviorSubject<PermissionStatus>('unknown');
	private _accessibilityStatus$ = new BehaviorSubject<PermissionStatus>('unknown');
	private _polling$: Subscription | null = null;

	public get status$() { return this._status$.asObservable(); }
	public get isGranted$() {
		return this._status$.pipe(map(s => s === 'granted'));
	}

	public get accessibilityStatus$() { return this._accessibilityStatus$.asObservable(); }
	public get isAccessibilityGranted$() {
		return this._accessibilityStatus$.pipe(map(s => s === 'granted'));
	}

	constructor(private readonly electronService: ElectronService) { }

	/** Check once */
	async checkStatus(): Promise<string> {
		const result = await this.electronService.ipcRenderer.invoke('CHECK_MACOS_PERMISSIONS');
		console.log('permissions check result', result);
		this._status$.next(result.screen);
		this._accessibilityStatus$.next(result.accessibility ?? 'unknown');
		return result.screen;
	}

	/** Poll every 2s — auto-stops when both permissions granted. Returns observable that emits true when screen is granted */
	startPolling(): Observable<boolean> {
		this.stopPolling();

		const polling$ = interval(2000).pipe(
			switchMap(() => from(this.checkStatus())),
			map(status => status === 'granted'),
			distinctUntilChanged(),
			tap(granted => { if (granted) this.stopPolling(); })
		);

		// Track the subscription so stopPolling() (called from ngOnDestroy) actually works
		this._polling$ = polling$.subscribe();

		return polling$;
	}

	stopPolling() {
		this._polling$?.unsubscribe();
		this._polling$ = null;
	}

	async testScreenshot(): Promise<{ success: boolean; thumbnail?: string; reason?: string }> {
		return this.electronService.ipcRenderer.invoke('TEST_SCREENSHOT');
	}

	async testGetWindow(): Promise<{ success: boolean; reason?: string; window?: { title?: string; bundleId?: string; appName?: string } }> {
		return this.electronService.ipcRenderer.invoke('TEST_GET_ACTIVE_WINDOW');
	}

	// ── Screen Recording ──────────────────────────────────────────────────────

	openSystemSettings(): void {
		this.electronService.ipcRenderer.invoke('OPEN_PRIVACY_SETTINGS');
	}

	async resetPermission(): Promise<{ success: boolean; error?: string }> {
		return this.electronService.ipcRenderer.invoke('RESET_SCREEN_PERMISSION');
	}

	// ── Accessibility ─────────────────────────────────────────────────────────

	openAccessibilitySettings(): void {
		this.electronService.ipcRenderer.invoke('OPEN_ACCESSIBILITY_SETTINGS');
	}

	async resetAccessibilityPermission(): Promise<{ success: boolean; error?: string }> {
		return this.electronService.ipcRenderer.invoke('RESET_ACCESSIBILITY_PERMISSION');
	}

	// ── Common ────────────────────────────────────────────────────────────────

	relaunchApp(): void {
		this.electronService.ipcRenderer.invoke('RELAUNCH_APP');
	}

	/** Returns the current OS platform (e.g. 'darwin', 'win32', 'linux'). */
	getPlatform(): Promise<'darwin' | 'win32' | 'linux'> {
		return this.electronService.ipcRenderer.invoke('GET_PLATFORM');
	}

	/** Returns whether hardware acceleration is currently disabled (Windows). */
	async getHardwareAccelerationState(): Promise<boolean> {
		return this.electronService.ipcRenderer.invoke('GET_HARDWARE_ACCELERATION_STATE');
	}

	/**
	 * Enable or disable hardware acceleration and schedule a relaunch.
	 * Calls app.disableHardwareAcceleration() before next launch via the main process.
	 */
	async setHardwareAcceleration(disabled: boolean): Promise<void> {
		return this.electronService.ipcRenderer.invoke('SET_HARDWARE_ACCELERATION', disabled);
	}
}
