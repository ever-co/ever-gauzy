import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	NbThemeService,
	NbLayoutDirectionService,
	NbLayoutDirection
} from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	LanguagesEnum,
	IUser,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { LanguagesService } from '../../../@core/services/languages.service';
import { UsersService } from '../../../@core/services';

@Component({
	selector: 'ngx-changelog',
	templateUrl: './changelog.component.html',
	styleUrls: ['./changelog.component.scss']
})
export class ChangelogComponent implements OnInit, OnDestroy {
	items = [
		{
			header: 'New: Zapier integration',
			date: 'Tue, Oct 13, 2020',
			content:
				'You can now connect Hubstaff with a number of apps by creating Zaps. Use Hubstaff triggers in Zapier to automate tasks.',
			icon: 'cube-outline'
		},
		{
			header: 'Group by to-dos in reports',
			date: 'Tue, Oct 13, 2020',
			content:
				'Time-tracking, stand-ups, sprints, timelines, and more at the fraction of the price for other PM tools.',
			icon: 'globe-outline'
		},
		{
			header: 'New: Zapier integration',
			date: 'Fri, May 22, 2020',
			content:
				'Make your reports easier to scan by grouping to-dos together.',
			icon: 'flash-outline'
		}
	];

	ngOnInit() {}

	ngOnDestroy() {}
}
