import { Component } from "@angular/core";
import { ChangelogComponent } from "../../../@theme/components/theme-sidebar/changelog/changelog.component";
import { untilDestroyed } from "@ngneat/until-destroy";
import { tap } from "rxjs/operators";
import { IChangelog } from "@gauzy/contracts";


@Component({
	selector: 'ngx-whats-new',
	templateUrl: './whats-new.component.html',
	styleUrls: ['./whats-new.component.scss'],
})
export class NgxWhatsNewComponent extends ChangelogComponent {
	learnMore: string | null

	ngOnInit () {
		super.ngOnInit();
		this.items$.subscribe(x => {
			console.log(x)
		})
	}
}
