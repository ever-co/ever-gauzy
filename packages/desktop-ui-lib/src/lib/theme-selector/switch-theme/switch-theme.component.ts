import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, from, tap } from 'rxjs';
import { ElectronService } from '../../electron/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-switch-theme',
	templateUrl: './switch-theme.component.html',
	styleUrls: ['./switch-theme.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SwitchThemeComponent implements OnInit {
	private _switch$ = new BehaviorSubject<boolean>(true);
	hasText = false;

	constructor(private electronService: ElectronService) {}

	ngOnInit(): void {
		from(this.electronService.ipcRenderer.invoke('PREFERRED_THEME'))
			.pipe(
				tap((theme) => (this.switch = theme === 'dark')),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public switchTheme(): void {
		const currentTheme = this.switch;
		this.switch = !currentTheme;
		this.electronService.ipcRenderer.send('THEME_CHANGE', this.switch ? 'dark' : 'light');
	}

	public get switch$(): Observable<boolean> {
		return this._switch$.asObservable();
	}

	public get switch(): boolean {
		return this._switch$.getValue();
	}

	public set switch(value: boolean) {
		this._switch$.next(value);
	}
}
