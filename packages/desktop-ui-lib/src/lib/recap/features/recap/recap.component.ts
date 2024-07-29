import { ChangeDetectionStrategy, Component, inject, NgZone, OnInit } from '@angular/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { NbRouteTab } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { from, Observable, tap } from 'rxjs';
import { RecapQuery } from '../../+state/recap.query';
import { ElectronService } from '../../../electron/services';
import { LanguageSelectorService } from '../../../language/language-selector.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-recap',
	templateUrl: './recap.component.html',
	styleUrls: ['./recap.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecapComponent implements OnInit {
	private readonly electronService = inject(ElectronService);
	private readonly languageSelectorService = inject(LanguageSelectorService);
	private readonly translateService = inject(TranslateService);
	private readonly ngZone = inject(NgZone);
	private readonly query = inject(RecapQuery);
	ngOnInit(): void {
		this.electronService.ipcRenderer.on('preferred_language_change', (event, language: LanguagesEnum) => {
			this.ngZone.run(() => {
				this.languageSelectorService.setLanguage(language, this.translateService);
			});
		});

		from(this.electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language: LanguagesEnum) => {
					this.languageSelectorService.setLanguage(language, this.translateService);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get isLoading$(): Observable<boolean> {
		return this.query.isLoading$;
	}

	public tabs(): NbRouteTab[] {
		return [
			{
				title: this.translateService.instant('TIMESHEET.APPS_URLS'),
				route: '/recap/daily/activities',
				icon: 'link-2-outline',
				responsive: true
			},
			{
				title: this.translateService.instant('TIMESHEET.PROJECTS'),
				route: '/recap/daily/projects',
				icon: 'cube-outline',
				responsive: true
			},
			{
				title: this.translateService.instant('TIMESHEET.TASKS'),
				route: '/recap/daily/tasks',
				icon: 'list-outline',
				responsive: true
			}
		];
	}
}
