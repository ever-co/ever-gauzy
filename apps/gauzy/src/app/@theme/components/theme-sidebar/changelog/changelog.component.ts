import { Component, OnInit, OnDestroy } from '@angular/core';
import { IChangelog } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ChangelogService } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-changelog',
	templateUrl: './changelog.component.html',
	styleUrls: ['./changelog.component.scss']
})
export class ChangelogComponent implements OnInit, OnDestroy {
	learnMore: string;
	items$: Observable<IChangelog[]> = this._changelogService.changelogs$;

	constructor(private readonly _changelogService: ChangelogService) {}

	ngOnInit() {
		this._changelogService
			.getAll({ isFeature: 0 })
			.pipe(untilDestroyed(this))
			.subscribe();
		this.items$
			.pipe(
				tap((changeLogs) =>
					changeLogs.forEach((log) => (this.learnMore = log.learnMoreUrl))
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
