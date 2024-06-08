import {
	Component,
	OnDestroy,
	OnInit,
	EventEmitter,
	Output,
	ChangeDetectorRef,
	Input,
	AfterViewInit,
	Inject
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { tap, debounceTime, filter } from 'rxjs/operators';
import { NbThemeService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { FeatureEnum, IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-logo',
	templateUrl: './gauzy-logo.component.html',
	styleUrls: ['./gauzy-logo.component.scss']
})
export class GauzyLogoComponent implements AfterViewInit, OnInit, OnDestroy {
	theme: string;
	isCollapse: boolean = true;
	organization: IOrganization;
	logoUrl: SafeResourceUrl;

	@Input() controlled: boolean = true;
	@Input() isAccordion: boolean = true;

	@Output() onCollapsed: EventEmitter<boolean> = new EventEmitter<boolean>(this.isCollapse);

	actions = [
		{
			title: 'Invite people',
			icon: 'fas fa-user-plus',
			link: '/pages/employees/invites',
			data: {
				translationKey: 'MENU.INVITE_PEOPLE',
				permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_INVITE_VIEW],
				featureKey: FeatureEnum.FEATURE_MANAGE_INVITE
			}
		},
		{
			title: 'Users',
			icon: 'fas fa-users',
			link: '/pages/users',
			data: {
				translationKey: 'MENU.USERS',
				permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_USERS_VIEW],
				featureKey: FeatureEnum.FEATURE_USER
			}
		},
		{
			title: 'Import/Export',
			icon: 'fas fa-exchange-alt',
			link: '/pages/settings/import-export',
			data: {
				translationKey: 'MENU.IMPORT_EXPORT.IMPORT_EXPORT',
				permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD, PermissionsEnum.EXPORT_ADD],
				featureKey: FeatureEnum.FEATURE_IMPORT_EXPORT
			}
		},
		{
			title: 'Organizations',
			icon: 'fas fa-globe',
			link: '/pages/organizations',
			data: {
				translationKey: 'MENU.ORGANIZATIONS',
				permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EXPENSES_EDIT],
				featureKey: FeatureEnum.FEATURE_ORGANIZATIONS
			}
		},
		{
			title: 'Integrations',
			icon: 'fas fa-swatchbook',
			link: '/pages/integrations',
			pathMatch: 'prefix',
			data: {
				translationKey: 'MENU.INTEGRATIONS',
				permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
				featureKey: FeatureEnum.FEATURE_APP_INTEGRATION
			}
		}
	];
	settings = {
		title: 'Settings',
		icon: 'fas fa-cog',
		data: {
			translationKey: 'MENU.SETTINGS'
		},
		children: [
			{
				title: 'General',
				icon: 'fas fa-pen',
				link: '/pages/settings/general',
				data: {
					translationKey: 'MENU.GENERAL',
					featureKey: FeatureEnum.FEATURE_SETTING
				}
			},
			{
				title: 'Features',
				icon: 'fas fa-swatchbook',
				link: '/pages/settings/features',
				data: {
					translationKey: 'MENU.FEATURES',
					permissionKeys: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW]
				}
			},
			{
				title: 'Email History',
				icon: 'fas fa-envelope-open',
				link: '/pages/settings/email-history',
				data: {
					translationKey: 'MENU.EMAIL_HISTORY',
					permissionKeys: [PermissionsEnum.VIEW_ALL_EMAILS],
					featureKey: FeatureEnum.FEATURE_EMAIL_HISTORY
				}
			},
			{
				title: 'Email Templates',
				icon: 'fas fa-envelope',
				link: '/pages/settings/email-templates',
				data: {
					translationKey: 'MENU.EMAIL_TEMPLATES',
					permissionKeys: [PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES],
					featureKey: FeatureEnum.FEATURE_EMAIL_TEMPLATE
				}
			},
			{
				title: 'Accounting Templates',
				icon: 'fas fa-address-card',
				link: '/pages/settings/accounting-templates',
				data: {
					translationKey: 'MENU.ACCOUNTING_TEMPLATES',
					permissionKeys: [PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES]
				}
			},
			{
				title: 'File storage',
				icon: 'fas fa-database',
				link: '/pages/settings/file-storage',
				data: {
					translationKey: 'MENU.FILE_STORAGE',
					permissionKeys: [PermissionsEnum.FILE_STORAGE_VIEW],
					featureKey: FeatureEnum.FEATURE_FILE_STORAGE
				}
			},
			{
				title: 'SMS Gateways',
				icon: 'fas fa-at',
				link: '/pages/settings/sms-gateway',
				data: {
					translationKey: 'MENU.SMS_GATEWAYS',
					permissionKeys: [PermissionsEnum.SMS_GATEWAY_VIEW],
					featureKey: FeatureEnum.FEATURE_SMS_GATEWAY
				}
			},
			{
				title: 'Custom SMTP',
				icon: 'fas fa-at',
				link: '/pages/settings/custom-smtp',
				data: {
					translationKey: 'MENU.CUSTOM_SMTP',
					permissionKeys: [PermissionsEnum.CUSTOM_SMTP_VIEW],
					featureKey: FeatureEnum.FEATURE_SMTP
				}
			},
			{
				title: 'Roles & Permissions',
				link: '/pages/settings/roles-permissions',
				icon: 'fas fa-award',
				data: {
					translationKey: 'MENU.ROLES',
					permissionKeys: [PermissionsEnum.CHANGE_ROLES_PERMISSIONS],
					featureKey: FeatureEnum.FEATURE_ROLES_PERMISSION
				}
			},
			{
				title: 'Danger Zone',
				link: '/pages/settings/danger-zone',
				icon: 'fas fa-radiation-alt',
				data: {
					translationKey: 'MENU.DANGER_ZONE',
					permissionKeys: [PermissionsEnum.ACCESS_DELETE_ACCOUNT, PermissionsEnum.ACCESS_DELETE_ALL_DATA]
				}
			}
		]
	};

	constructor(
		private readonly themeService: NbThemeService,
		private readonly domSanitizer: DomSanitizer,
		private readonly cd: ChangeDetectorRef,
		private readonly store: Store,
		@Inject(GAUZY_ENV) private readonly environment: Environment
	) {
		this.logoUrl = this.domSanitizer.bypassSecurityTrustResourceUrl(environment.PLATFORM_LOGO);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.themeService.onThemeChange().subscribe((theme) => {
			this.theme = theme.name;
			this.cd.detectChanges();
		});
	}

	onCollapse(event: boolean) {
		this.isCollapse = event;
		this.onCollapsed.emit(this.isCollapse);
	}

	navigateHome() {
		//this.menuService.navigateHome();
		return false;
	}

	public get isSVG(): boolean {
		return this.environment.PLATFORM_LOGO.endsWith('.svg');
	}

	ngOnDestroy(): void {}
}
