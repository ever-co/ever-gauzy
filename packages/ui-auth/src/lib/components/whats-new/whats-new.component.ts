import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs/internal/Observable';
import { tap } from 'rxjs/operators';
import { IChangelog } from '@gauzy/contracts';
import { ChangelogService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-whats-new',
	templateUrl: './whats-new.component.html',
	styleUrls: ['./whats-new.component.scss']
})
export class NgxWhatsNewComponent implements OnInit {
	learnMore: string;
	items$: Observable<IChangelog[]> = this._changelogService.changelogs$;

	constructor(private readonly _changelogService: ChangelogService) {}

	ngOnInit() {
		this._changelogService.getAll({ isFeature: 0 }).pipe(untilDestroyed(this)).subscribe();
		this.items$
			.pipe(
				tap((changeLogs) => changeLogs.forEach((x) => (this.learnMore = x.learnMoreUrl))),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
