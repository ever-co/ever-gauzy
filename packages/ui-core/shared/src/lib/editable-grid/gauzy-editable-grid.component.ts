import { Component, OnInit, Input, TemplateRef, EventEmitter, Output, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { take, tap, filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

export type ItemActionType = 'create' | 'edit' | 'delete';

@UntilDestroy()
@Component({
	selector: 'ga-editable-grid',
	templateUrl: './gauzy-editable-grid.component.html',
	styleUrls: ['./gauzy-editable-grid.component.scss']
})
export class GauzyEditableGridComponent<T extends { id?: string }>
	extends TranslationBaseComponent
	implements OnInit, OnDestroy
{
	@Input() items: T[];
	@Input() itemTmpl?: TemplateRef<{ $implicit: any }>;

	@Input() addDialogTmpl: TemplateRef<any>;
	@Input() editDialogTmpl: TemplateRef<any>;
	@Input() deleteDialogTmpl: TemplateRef<any>;

	@Output() dialogData: EventEmitter<any> = new EventEmitter();
	selectedItem: T;
	currentAction: ItemActionType = null;

	constructor(public readonly translateService: TranslateService, private dialogService: NbDialogService) {
		super(translateService);
	}

	ngOnInit(): void {}

	toggleItemSelection(item: T): void {
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
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
