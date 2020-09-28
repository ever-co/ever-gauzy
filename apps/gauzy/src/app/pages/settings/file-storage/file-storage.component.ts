import { Component, OnInit } from '@angular/core';
import { FileStorageProviderEnum, ITenantSetting } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TenantService } from '../../../@core/services/tenant.service';
import { ToastrService } from '../../../@core/services/toastr.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-file-storage',
	templateUrl: './file-storage.component.html',
	providers: [TenantService]
})
export class FileStorageComponent extends TranslationBaseComponent
	implements OnInit {
	settings: ITenantSetting = {
		fileStorageProvider: FileStorageProviderEnum.S3
	};

	FileStorageProviderEnum = FileStorageProviderEnum;

	fileStorageProviders: { label: string; value: any }[];

	constructor(
		translate: TranslateService,
		private tenantService: TenantService,
		private toastrService: ToastrService
	) {
		super(translate);
	}

	ngOnInit() {
		this.fileStorageProviders = Object.keys(
			FileStorageProviderEnum
		).map((label) => ({ label, value: FileStorageProviderEnum[label] }));

		this.tenantService.getSettings().then((settings) => {
			this.settings = settings;
		});
	}

	submit() {
		console.log(this.settings);
		this.tenantService.saveSettings(this.settings).then(() => {
			this.toastrService.success('Settings saved successfully');
		});
	}
}
