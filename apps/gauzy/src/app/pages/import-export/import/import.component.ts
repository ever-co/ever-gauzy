import { AfterViewInit, Component, OnInit } from '@angular/core';
import { FileUploader } from 'ng2-file-upload';
import { NbToastrService, NbGlobalPhysicalPosition } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ActivatedRoute } from '@angular/router';
import { IImportHistory, ImportTypeEnum, ImportHistoryStatusEnum } from '@gauzy/contracts';
import { Subject } from 'rxjs/internal/Subject';
import { Observable } from 'rxjs/internal/Observable';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { API_PREFIX } from '../../../@core/constants';
import { ImportService, Store } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-download',
	templateUrl: './import.component.html',
	styleUrls: ['./import.component.scss']
})
export class ImportComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit {

	history$: Observable<IImportHistory[]> = this.importService.history$;

	uploader: FileUploader;
	hasBaseDropZoneOver: boolean;
	hasAnotherDropZoneOver: boolean;
	importDT: Date = new Date();
	importTypeEnum = ImportTypeEnum;
	importType = ImportTypeEnum.MERGE;
	subject$: Subject<any> = new Subject();
	loading: boolean;
	importHistoryStatusEnum = ImportHistoryStatusEnum;
	
	constructor(
		private readonly route: ActivatedRoute,
		private readonly toastrService: NbToastrService,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly importService: ImportService,
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params),
				tap((params) => this.importType = params.get('importType') as ImportTypeEnum),
				tap(() => this.initUploader()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap(() => this.initUploader()),
				tap(() => this.uploader.clearQueue()),
				untilDestroyed(this)
			)
			.subscribe();
		this.subject$
			.pipe(
				tap(() => this.loading = true),
				tap(() => this.getImportHistory()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.subject$.next();
	}

	initUploader() {
		this.uploader = new FileUploader({
			url: `${API_PREFIX}/import`,
			itemAlias: 'file',
			authTokenHeader: 'Authorization',
			authToken: `Bearer ${this.store.token}`,
			headers: [{ 
				name: "Tenant-Id", 
				value: `${this.store.user.tenantId}` 
			}]
		});
		this.uploader.onBuildItemForm = (item, form) => {
			form.append('importType', this.importType);
		};
		this.uploader.onCompleteItem = () => {
			this.subject$.next();
		};
		this.hasBaseDropZoneOver = false;
	}

	onImportTypeChange(e: ImportTypeEnum) {
		this.importType = e;
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
		this.importService.getHistory()
			.pipe(
				untilDestroyed(this)
			).subscribe();
	}
}
