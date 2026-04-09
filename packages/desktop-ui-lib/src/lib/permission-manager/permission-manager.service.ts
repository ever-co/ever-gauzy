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

@Injectable({ providedIn: 'root' })
export class PermissionManagerService {
    private _status$ = new BehaviorSubject<'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'>('unknown');
    private _polling$: Subscription | null = null;

    public get status$() { return this._status$.asObservable(); }
    public get isGranted$() {
        return this._status$.pipe(map(s => s === 'granted'));
    }

    constructor(private readonly electronService: ElectronService) {}

    /** Check once */
    async checkStatus(): Promise<string> {
        const result = await this.electronService.ipcRenderer.invoke('CHECK_MACOS_PERMISSIONS');
        this._status$.next(result.screen);
        return result.screen;
    }

    /** Poll every 2s — auto-stops when granted. Returns observable that emits true when granted */
    startPolling(): Observable<boolean> {
        return interval(2000).pipe(
            switchMap(() => from(this.checkStatus())),
            map(status => status === 'granted'),
            distinctUntilChanged(),
            tap(granted => { if (granted) this.stopPolling(); })
        );
    }

    stopPolling() {
        this._polling$?.unsubscribe();
        this._polling$ = null;
    }

    async testScreenshot(): Promise<{ success: boolean; thumbnail?: string; reason?: string }> {
        return this.electronService.ipcRenderer.invoke('TEST_SCREENSHOT');
    }

    openSystemSettings(): void {
        this.electronService.ipcRenderer.invoke('OPEN_PRIVACY_SETTINGS');
    }

    async resetPermission(): Promise<{ success: boolean; error?: string }> {
        return this.electronService.ipcRenderer.invoke('RESET_SCREEN_PERMISSION');
    }

    relaunchApp(): void {
        this.electronService.ipcRenderer.invoke('RELAUNCH_APP');
    }
}
