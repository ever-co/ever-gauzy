import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ExportAllService } from '../../@core/services/exportAll.service';
import { saveAs } from 'file-saver';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-import-export',
	templateUrl: './import-export.html'
})
export class ImportExportComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(private exportAll: ExportAllService, private router: Router) {}

	ngOnInit() {}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	importPage() {
		this.router.navigate(['/pages/settings/import-export/import']);
	}

	exportPage() {
		this.router.navigate(['/pages/settings/import-export/export']);
	}

	onDownloadTemplates() {
		this.exportAll
			.downloadTemplates()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => saveAs(data, `template.zip`));
	}
}
