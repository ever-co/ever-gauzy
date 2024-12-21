import { Component, OnInit, OnDestroy } from '@angular/core';
import { IChangelog } from '@gauzy/contracts';
import { NbSidebarService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ChangelogService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-changelog',
    templateUrl: './changelog.component.html',
    styleUrls: ['./changelog.component.scss'],
    standalone: false
})
export class ChangelogComponent implements OnInit, OnDestroy {
	learnMore: string;
	items$: Observable<IChangelog[]> = this._changelogService.changelogs$;

	constructor(
		private readonly _changelogService: ChangelogService,
		private readonly _sidebarService: NbSidebarService
	) {}

	ngOnInit() {
		this._changelogService.getAll({ isFeature: 0 }).pipe(untilDestroyed(this)).subscribe();
		this.items$
			.pipe(
				tap((changeLogs) => changeLogs.forEach((log) => (this.learnMore = log.learnMoreUrl))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public closeSidebar() {
		this._sidebarService.toggle(false, 'changelog_sidebar');
	}

	ngOnDestroy(): void {}
}
