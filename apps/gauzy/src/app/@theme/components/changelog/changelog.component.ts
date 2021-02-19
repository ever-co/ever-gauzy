import { Component, OnInit, OnDestroy } from '@angular/core';
import { IChangelog } from '@gauzy/contracts';
import { ChangelogService } from '../../../@core/services/changelog.service';

@Component({
	selector: 'ngx-changelog',
	templateUrl: './changelog.component.html',
	styleUrls: ['./changelog.component.scss']
})
export class ChangelogComponent implements OnInit, OnDestroy {
	constructor(private changelogService: ChangelogService) {}

	items: IChangelog[] = [];

	ngOnInit() {
		this.getAll();
	}

	async getAll() {
		const { items } = await this.changelogService.getAll();
		this.items = items;
	}

	ngOnDestroy() {}
}
