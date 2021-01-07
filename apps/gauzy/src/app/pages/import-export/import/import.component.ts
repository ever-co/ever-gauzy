import { Component, OnInit } from '@angular/core';
import { FileUploader } from 'ng2-file-upload';
import { NbToastrService, NbGlobalPhysicalPosition } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

const URL = '/api/import';
@Component({
	selector: 'ngx-download',
	templateUrl: './import.component.html',
	styleUrls: ['./import.component.scss']
})
export class ImportComponent
	extends TranslationBaseComponent
	implements OnInit {
	uploader: FileUploader;
	hasBaseDropZoneOver: boolean;
	hasAnotherDropZoneOver: boolean;
	response: string;
	selectedFile: File = null;
	exportName = false;
	importDT: Date = new Date();
	importType = 'merge';

	constructor(
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.uploader = new FileUploader({
			url: URL,
			itemAlias: 'file'
		});
		this.uploader.onBuildItemForm = (item, form) => {
			form.append('importType', this.importType);
		};

		this.hasBaseDropZoneOver = false;
	}

	onImportTypeChange(e) {
		this.importType = e;
	}

	public dropFile(e) {
		if (e[0].name !== 'import.zip' || Object.values(e).length > 1) {
			this.uploader.clearQueue();
			this.toastrService.danger(
				this.getTranslation('MENU.IMPORT_EXPORT.CORRECT_FILE_NAME'),
				this.getTranslation('MENU.IMPORT_EXPORT.WRONG_FILE_NAME'),
				{ position: NbGlobalPhysicalPosition.BOTTOM_LEFT }
			);
		}
	}

	fileOverBase(e) {
		this.hasBaseDropZoneOver = e;
	}

	ngOnInit() {
		this.uploader.clearQueue();
	}

	onFileClick(event) {
		this.selectedFile = event.target.files[0];
		if (event.target.files[0].name !== 'import.zip') {
			this.uploader.queue[0].remove();
			this.toastrService.danger(
				this.getTranslation('MENU.IMPORT_EXPORT.CORRECT_FILE_NAME'),
				this.getTranslation('MENU.IMPORT_EXPORT.WRONG_FILE_NAME'),
				{ position: NbGlobalPhysicalPosition.BOTTOM_LEFT }
			);
		}
		event.target.value = '';
	}
}
