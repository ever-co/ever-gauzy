import { Component, OnInit } from '@angular/core';
import { FileStorageProviderEnum, ITenantSetting, IUser } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Store, TenantService, ToastrService } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-file-storage',
	templateUrl: './file-storage.component.html',
	providers: [TenantService]
})
export class FileStorageComponent
	extends TranslationBaseComponent
	implements OnInit {

	user: IUser;
	settings: ITenantSetting = new Object();
	fileStorageProviderEnum = FileStorageProviderEnum;
	fileStorageProviders: { label: string; value: any }[];

	constructor(
		public readonly translate: TranslateService,
		private readonly tenantService: TenantService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translate);
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.getSetting()),
				tap(() => this.getFileStorageProviders()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * GET file storage providers
	 */
	getFileStorageProviders() {
		this.fileStorageProviders = Object.keys(FileStorageProviderEnum).map(
			(label) => ({
				label,
				value: FileStorageProviderEnum[label]
			})
		);
	}

	/**
	 * GET current tenant file storage setting
	 */
	async getSetting() {
		const settings = await this.tenantService.getSettings();
		this.settings = settings || {
			fileStorageProvider: FileStorageProviderEnum.LOCAL
		}
	}

	/**
	 * SAVE current tenant file storage setting
	 */
	submit() {
		this.tenantService.saveSettings(this.settings).then(() => {
			this.toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		});
	}
}
