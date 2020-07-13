import {
	Component,
	OnInit,
	Input,
	TemplateRef,
	EventEmitter,
	Output,
	OnDestroy,
	ViewChild
} from '@angular/core';

import { TranslateService } from '@ngx-translate/core';
import {
	NbComponentStatus,
	NbComponentSize,
	NbDialogService,
	NbDialogRef
} from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil, take, tap } from 'rxjs/operators';

import { TranslationBaseComponent } from '../../language-base/translation-base.component';

export type ItemActionType = 'create' | 'edit' | 'delete';

@Component({
	selector: 'ga-editable-grid',
	templateUrl: './gauzy-editable-grid.component.html',
	styleUrls: ['./gauzy-editable-grid.component.css']
})
export class GauzyEditableGridComponent<T extends { id: string | number }>
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() items: T[];
	@Input() itemTmpl?: TemplateRef<{ $implicit: any }>;

	@Input() addDialogTmpl: TemplateRef<any>;
	@Input() editDialogTmpl: TemplateRef<any>;
	@Input() deleteDialogTmpl: TemplateRef<any>;

	@Input() dialogTmpl: TemplateRef<{
		$implicit: any;
		itemAction: ItemActionType;
	}>;
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

	selectItem(item: T): void {
		this.selectedItem = item;
	}

	openDialog(itemAction: ItemActionType, template: TemplateRef<any>): void {
		this.currentAction = itemAction;
		this.dialogService
			.open(template, {
				context: {
					action: itemAction
				}
			})
			.onClose.pipe(
				tap((data: Partial<T>) => {
					this.selectedItem = null;
					this.currentAction = itemAction;
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
