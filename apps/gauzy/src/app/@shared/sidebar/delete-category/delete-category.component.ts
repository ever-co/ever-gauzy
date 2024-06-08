import { IHelpCenter } from '@gauzy/contracts';
import { Component, OnDestroy, Input, ErrorHandler } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { HelpCenterService } from '@gauzy/ui-sdk/core';

@Component({
	selector: 'ga-delete-category',
	templateUrl: 'delete-category.component.html',
	styleUrls: ['delete-category.component.scss']
})
export class DeleteCategoryComponent extends TranslationBaseComponent implements OnDestroy {
	@Input() category: IHelpCenter;

	constructor(
		protected readonly dialogRef: NbDialogRef<DeleteCategoryComponent>,
		public readonly translateService: TranslateService,
		private readonly helpCenterService: HelpCenterService,
		private readonly errorHandler: ErrorHandler
	) {
		super(translateService);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	async deleteCategory() {
		try {
			await this.helpCenterService.delete(this.category.id);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		this.dialogRef.close(this.category);
	}

	ngOnDestroy() {}
}
