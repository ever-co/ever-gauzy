import { Component } from "@angular/core";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { Observable } from "rxjs";
import { IChangelog } from "@gauzy/contracts";
import { ChangelogService } from "../../../@core";
import { tap } from "rxjs/operators";


@UntilDestroy({checkProperties: true})
@Component({
	selector: 'ngx-whats-new',
	templateUrl: './whats-new.component.html',
	styleUrls: ['./whats-new.component.scss'],
})
export class NgxWhatsNewComponent {
	learnMore: string
	items$: Observable<IChangelog[]> = this._changelogService.changelogs$;

	constructor(
		private readonly _changelogService: ChangelogService
	) {}

	ngOnInit () {
		this._changelogService.getAll({ isFeature : false })
			.pipe(
				untilDestroyed(this)
			).subscribe();
		this.items$
			.pipe(
				tap(changeLogs => changeLogs.forEach(x => this.learnMore = x.learnMoreUrl)),
				untilDestroyed(this)
			)
			.subscribe()
	}
}
