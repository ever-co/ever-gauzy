import { AfterViewInit, Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FileUploader } from 'ng2-file-upload';
import { NbToastrService, NbGlobalPhysicalPosition } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ActivatedRoute, Params } from '@angular/router';
import { IImportHistory, ImportTypeEnum, ImportStatusEnum } from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { saveAs } from 'file-saver';
import { environment } from '@gauzy/ui-config';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/common';
import { ImportService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-import',
	templateUrl: './import.component.html',
	styleUrls: ['./import.component.scss']
})
export class ImportComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	history$: Observable<IImportHistory[]> = this.importService.history$;

	uploader: FileUploader;
	hasBaseDropZoneOver: boolean;
	hasAnotherDropZoneOver: boolean;
	importDT: Date = new Date();
	importTypeEnum = ImportTypeEnum;
	importType = ImportTypeEnum.MERGE;
	importStatus = ImportStatusEnum;
	subject$: Subject<any> = new Subject();
	loading: boolean;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly toastrService: NbToastrService,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly importService: ImportService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap(() => this.initUploader()),
				untilDestroyed(this)
			)
			.subscribe();
		this.subject$
			.pipe(
				tap(() => this.getImportHistory()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.route.queryParamMap
			.pipe(
				filter((params: Params) => !!params && !!params.get('importType')),
				tap((params: Params) => (this.importType = params.get('importType') as ImportTypeEnum)),
				tap(() => this.initUploader()),
				untilDestroyed(this)
			)
			.subscribe();
		this.subject$.next(true);
		this.cdr.detectChanges();
	}

	initUploader() {
		this.uploader = new FileUploader({
			url: environment.API_BASE_URL + `${API_PREFIX}/import`,
			itemAlias: 'file',
			authTokenHeader: 'Authorization',
			authToken: `Bearer ${this.store.token}`,
			headers: [
				{
					name: 'Tenant-Id',
					value: `${this.store.user.tenantId}`
				}
			]
		});
		this.uploader.onBeforeUploadItem = (item => {
			item.withCredentials = false;
		});
		this.uploader.onBuildItemForm = (item, form) => {
			form.append('importType', this.importType);
		};
		this.uploader.onCompleteItem = () => {
			this.subject$.next(true);
			this.initUploader();
		};
		this.hasBaseDropZoneOver = false;
	}

	onImportTypeChange(e: ImportTypeEnum) {
		this.importType = e;
		this.initUploader();
	}

	public dropFile(e: any) {
		if (e[0].name !== 'archive.zip' || Object.values(e).length > 1) {
			this.uploader.clearQueue();
			this.alert();
		}
	}

	fileOverBase(e: any) {
		this.hasBaseDropZoneOver = e;
	}

	public onFileClick(e: any) {
		if (e.target.files[0].name !== 'archive.zip') {
			this.uploader.clearQueue();
			this.alert();
		}
		e.target.value = '';
	}

	alert() {
		this.toastrService.danger(
			this.getTranslation('MENU.IMPORT_EXPORT.CORRECT_FILE_NAME'),
			this.getTranslation('MENU.IMPORT_EXPORT.WRONG_FILE_NAME'),
			{ position: NbGlobalPhysicalPosition.TOP_RIGHT }
		);
	}

	getImportHistory() {
		this.loading = true;
		this.importService
			.getHistory()
			.pipe(
				tap(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
		this.cdr.detectChanges();
	}

	/**
	 * Download Import History Files
	 *
	 * @param item
	 */
	public download(item: IImportHistory) {
		if (item) {
			saveAs(item.fullUrl, item.file);
		}
	}
}
