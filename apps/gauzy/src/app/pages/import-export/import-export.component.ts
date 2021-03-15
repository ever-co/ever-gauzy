import { Component, OnInit } from '@angular/core';
import { saveAs } from 'file-saver';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ExportAllService } from '../../@core/services/export-all.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-import-export',
	templateUrl: './import-export.html'
})
export class ImportExportComponent implements OnInit {
	constructor(private exportAll: ExportAllService, private router: Router) {}

	ngOnInit() {}

	importPage() {
		this.router.navigate(['/pages/settings/import-export/import']);
	}

	exportPage() {
		this.router.navigate(['/pages/settings/import-export/export']);
	}

	onDownloadTemplates() {
		this.exportAll
			.downloadTemplates()
			.pipe(untilDestroyed(this))
			.subscribe((data) => saveAs(data, `template.zip`));
	}
}
