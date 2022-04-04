import { Component } from "@angular/core";
import { ChangelogComponent } from "../../../@theme/components/theme-sidebar/changelog/changelog.component";
import { IChangelog } from "@gauzy/contracts";
import { tap } from "rxjs/operators";
import { untilDestroyed } from "@ngneat/until-destroy";


@Component({
	selector: 'ngx-whats-new',
	templateUrl: './whats-new.component.html',
	styleUrls: ['./whats-new.component.scss'],
})
export class NgxWhatsNewComponent extends ChangelogComponent {
	learnMore: string

	ngOnInit () {
		super.ngOnInit();
		this.items$
			.pipe(
				tap(changeLogs => changeLogs.forEach(x => this.learnMore = x.learnMoreUrl)),
				untilDestroyed(this)
			)
			.subscribe()
	}
}
