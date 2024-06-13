import { Component, OnInit } from '@angular/core';
import { IChangelog } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs/internal/Observable';
import { Subject } from 'rxjs/internal/Subject';
import { ChangelogService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-register-side-features',
	templateUrl: './register-side-features.component.html',
	styleUrls: ['./register-side-features.component.scss']
})
export class NgxRegisterSideFeaturesComponent implements OnInit {
	subject$: Subject<any> = new Subject();
	items$: Observable<IChangelog[]> = this._changelogService.changelogs$;

	constructor(private readonly _changelogService: ChangelogService) {}

	ngOnInit() {
		this._changelogService.getAll({ isFeature: 1 }).pipe(untilDestroyed(this)).subscribe();
	}
}
