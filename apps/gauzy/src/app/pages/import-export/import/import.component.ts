import { Component, OnInit, OnDestroy } from '@angular/core';
import { FileUploader } from 'ng2-file-upload';
import { NbToastrService, NbGlobalPhysicalPosition } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

const URL = '/api/import';
@Component({
	selector: 'ngx-download',
	templateUrl: './import.component.html',
	styleUrls: ['./import.component.scss']
})
export class ImportComponent implements OnInit, OnDestroy {
	uploader: FileUploader;
	hasBaseDropZoneOver: boolean;
	hasAnotherDropZoneOver: boolean;
	response: string;
	selectedFile: File = null;
	exportName = false;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private toastrService: NbToastrService,
		private translate: TranslateService,
		private http: HttpClient
	) {
		this.uploader = new FileUploader({
			url: URL,
			itemAlias: 'file'
		});

		this.hasBaseDropZoneOver = false;
	}

	public dropFile(e) {
		if (e[0].name !== 'export.zip' || Object.values(e).length > 1) {
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
		if (event.target.files[0].name !== 'export.zip') {
			this.uploader.queue[0].remove();
			this.toastrService.danger(
				this.getTranslation('MENU.IMPORT_EXPORT.CORRECT_FILE_NAME'),
				this.getTranslation('MENU.IMPORT_EXPORT.WRONG_FILE_NAME'),
				{ position: NbGlobalPhysicalPosition.BOTTOM_LEFT }
			);
		}
		event.target.value = '';
	}

	getTranslation(prefix: string) {
		let result = '';
		this.translate
			.get(prefix)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((res) => {
				result = res;
			});
		return result;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
