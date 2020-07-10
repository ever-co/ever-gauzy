import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	tabs: any[];
	private _ngDestroy$ = new Subject<void>();
	constructor(
		readonly translateService: TranslateService,
		private route: ActivatedRoute
	) {
		super(translateService);
	}
	ngOnInit() {
		this.loadTabs();
		this._applyTranslationOnTabs();
	}
	getRoute(tab: string): string {
		return `/pages/employees/candidates/interviews/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CALENDAR'
				),
				responsive: true,
				route: this.getRoute('calendar')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.INTERVIEWS'
				),
				responsive: true,
				route: this.getRoute('interview_panel')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CRITERIONS'
				),
				responsive: true,
				route: this.getRoute('criterion')
			}
		];
	}
	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadTabs();
			});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
