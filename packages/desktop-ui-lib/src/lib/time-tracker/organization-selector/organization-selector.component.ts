import {
	Component,
	OnInit,
	Output,
	EventEmitter,
	AfterViewInit,
	NgZone,
} from '@angular/core';
import { IOrganization, IUserOrganization } from '@gauzy/contracts';
import { uniq } from 'underscore';
import { UserOrganizationService } from './user-organization.service';
import { ElectronService } from '../../electron/services';

@Component({
	selector: 'ga-organization-selector',
	templateUrl: './organization-selector.component.html',
	styleUrls: ['./organization-selector.component.scss'],
})
export class OrganizationSelectorComponent implements OnInit, AfterViewInit {
	private _user: IUserOrganization;
	private _auth: any;
	organizations: IOrganization[] = [];
	selectedOrganization: IOrganization;
	@Output()
	organizationChange: EventEmitter<IOrganization>;

	constructor(
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _electronService: ElectronService,
		private readonly _ngZone: NgZone
	) {
		this.organizationChange = new EventEmitter();
	}
	ngAfterViewInit(): void {
		this._electronService.ipcRenderer.on(
			'timer_tracker_show',
			(event, arg) => {
				this._ngZone.run(async () => {
					console.log('USER_ORG', arg);
					this._auth = arg;
					this.user = await this._userOrganizationService.detail(
						this._auth
					);
					this.loadOrganizations();
				});
			}
		);
	}

	ngOnInit() {}

	public selectOrganization(organization: IOrganization) {
		if (organization) {
			this.selectedOrganization = organization;
			this.organizationChange.emit(organization);
		}
	}

	private async loadOrganizations(): Promise<void> {
		if (!this.user) {
			return;
		}
		const { tenantId, userId } = this.user;

		const { items = [] } = await this._userOrganizationService.all(
			[
				'organization',
				'organization.contact',
				'organization.featureOrganizations',
				'organization.featureOrganizations.feature',
			],
			{ userId, tenantId },
			this._auth
		);

		const organizations: IOrganization[] = items
			.map(({ organization, userId }) => {
				return userId === this.user.id ? organization : null;
			})
			.filter((organization) => !!organization);
		this.organizations = uniq(organizations, (item) => item.id);

		if (this.organizations.length > 0) {
			const defaultOrganization = this.organizations.find(
				(organization: IOrganization) => organization.isDefault
			);
			const [firstOrganization] = this.organizations;

			if (this.organizationId) {
				const organization = this.organizations.find(
					(organization: IOrganization) =>
						organization.id === this.organizationId
				);
				this.selectedOrganization =
					organization || defaultOrganization || firstOrganization;
			} else {
				// set default organization as selected
				this.selectedOrganization =
					defaultOrganization || firstOrganization;
			}
		}
	}
	public get organizationId(): string {
		if (this.selectedOrganization) {
			return this.selectedOrganization.id;
		} else {
			return null;
		}
	}

	/* A getter and setter. */
	public set user(value: IUserOrganization) {
		if (value) {
			this._user = value;
		}
	}

	public get user(): IUserOrganization {
		return this._user;
	}
}
