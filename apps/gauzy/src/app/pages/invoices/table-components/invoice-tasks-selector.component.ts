import { Component, OnInit, OnDestroy } from '@angular/core';
import { Task } from '@gauzy/models';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

@Component({
	template: `
		<ng-select
			[(items)]="tasks"
			bindName="title"
			placeholder="{{ 'INVOICES_PAGE.SELECT_TASK' | translate }}"
			[(ngModel)]="task"
			(change)="selectTask($event)"
			[searchFn]="searchTask"
		>
			<ng-template ng-option-tmp let-item="item" let-index="index">
				{{ item.title }}
			</ng-template>
			<ng-template ng-label-tmp let-item="item">
				<div class="selector-template">
					<span>{{ item.title }}</span>
				</div>
			</ng-template>
		</ng-select>
	`,
	styles: []
})
export class InvoiceTasksSelectorComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	tasks: Task[] = [];
	task: Task;
	private _ngDestroy$ = new Subject<void>();

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	value: any;
	rowData: any;

	ngOnInit() {
		this.tasks = this.rowData.allTasks;
		this.task = this.rowData.task ? this.rowData.task : null;
	}

	selectTask($event) {
		this.rowData.task = $event;
	}

	searchTask(term: string, item: any) {
		if (item.title) {
			return item.title.toLowerCase().includes(term.toLowerCase());
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
