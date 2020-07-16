import {
	Component,
	OnInit,
	Input,
	TemplateRef,
	EventEmitter,
	Output,
	OnDestroy
} from '@angular/core';

import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil, take, tap, filter } from 'rxjs/operators';

import { TranslationBaseComponent } from '../../language-base/translation-base.component';

export type ItemActionType = 'create' | 'edit' | 'delete';

@Component({
	selector: 'ga-editable-grid',
	templateUrl: './gauzy-editable-grid.component.html',
	styleUrls: ['./gauzy-editable-grid.component.css']
})
export class GauzyEditableGridComponent<T extends { id?: string }>
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() items: T[];
	@Input() itemTmpl?: TemplateRef<{ $implicit: any }>;

	@Input() addDialogTmpl: TemplateRef<any>;
	@Input() editDialogTmpl: TemplateRef<any>;
	@Input() deleteDialogTmpl: TemplateRef<any>;

	@Output() dialogData: EventEmitter<any> = new EventEmitter();
	selectedItem: T;
	currentAction: ItemActionType = null;

	private _onDestroy$: Subject<void> = new Subject<void>();

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit(): void {}

	toggleItemSelection(item: T): void {
		console.log(7, item);
		if (!this.selectedItem || this.selectedItem.id !== item.id) {
			this.selectedItem = item;
			return;
		}
		this.selectedItem = null;
	}

	openDialog(itemAction: ItemActionType, template: TemplateRef<any>): void {
		this.currentAction = itemAction;
		this.dialogService
			.open(
				template
				// {
				//   context: {
				//     action: itemAction
				//   }
				// }
			)
			.onClose.pipe(
				tap(() => {
					this.selectedItem = null;
				}),
				filter(Boolean),
				tap((data: Partial<T>) => {
					// this.currentAction = itemAction;
					this.dialogData.emit({
						actionType: itemAction,
						data
					});
				}),
				take(1),
				takeUntil(this._onDestroy$)
			)
			.subscribe();
	}

	ngOnDestroy(): void {
		this._onDestroy$.next();
		this._onDestroy$.complete();
	}
}
