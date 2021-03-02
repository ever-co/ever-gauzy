import { Component, OnInit, OnDestroy } from '@angular/core';
import { IChangelog } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ChangelogService } from '../../../@core/services/changelog.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-changelog',
	templateUrl: './changelog.component.html',
	styleUrls: ['./changelog.component.scss']
})
export class ChangelogComponent implements OnInit, OnDestroy {
	updateLogs$: Subject<any> = new Subject();
	items$: Observable<IChangelog[]> = this._changelogService.changelogs$;

	constructor(private readonly _changelogService: ChangelogService) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.updateLogs$.next();
	}

	getLogs() {
		this._changelogService.getAll().pipe(untilDestroyed(this)).subscribe();
	}

	ngOnDestroy(): void {}
}
