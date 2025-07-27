import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IEmployee,
	IFavorite,
	IOrganization,
	IOrganizationContact,
	IOrganizationContactCreateInput
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { LatLng } from 'leaflet';
import { firstValueFrom } from 'rxjs';
import { filter, switchMap, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FilterArrayPipe, LeafletMapComponent } from '@gauzy/ui-core/shared';
import { Store } from '@gauzy/ui-core/core';
import { EmployeesService, OrganizationContactService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-contact-view',
	templateUrl: './contact-view.component.html',
	styleUrls: ['./contact-view.component.scss'],
	standalone: false
})
export class ContactViewComponent extends TranslationBaseComponent implements OnInit {
	tabs: any[];
	organization: IOrganization;
	selectedContact: IOrganizationContact;
	loading: boolean;
	@ViewChild('leafletTemplate', { static: false }) leafletTemplate: LeafletMapComponent;
	selectedMembers: IEmployee[];
	selectedEmployeeIds: string[];
	members: string[];
	employees: IEmployee[] = [];

	constructor(
		readonly translateService: TranslateService,
		private activatedRoute: ActivatedRoute,
		private readonly organizationContactService: OrganizationContactService,
		private readonly store: Store,
		private readonly cd: ChangeDetectorRef,
		private readonly employeesService: EmployeesService,
		private readonly filterArrayPipe: FilterArrayPipe
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Watch for route parameter changes to handle navigation between different contacts
		this.activatedRoute.params
			.pipe(
				filter((params) => !!params && !!params.id),
				tap((params) => {
					this.loading = true;
					this.selectedContact = null; // Clear previous contact data
				}),
				switchMap((params) => {
					// Return the contact ID for the next operator
					return Promise.resolve(params.id);
				}),
				tap((contactId: string) => this._init(contactId)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _init(id: string) {
		if (id) {
			const { tenantId } = this.store.user;
			this.organizationContactService
				.getById(id, tenantId, ['projects', 'members', 'members.user', 'tags', 'contact'])
				.then((items) => {
					if (items) {
						this.selectedContact = items;
						if (this.selectedContact.contact.latitude && this.selectedContact.contact.longitude) {
							setTimeout(() => {
								// Check if leafletTemplate exists before adding marker
								if (this.leafletTemplate) {
									this.leafletTemplate.addMarker(
										new LatLng(
											this.selectedContact.contact.latitude,
											this.selectedContact.contact.longitude
										)
									);
								}
							}, 200);
						}
					}
				})
				.catch((error) => {
					console.error('Error loading contact:', error);
					this.selectedContact = null;
				})
				.finally(() => {
					this.loading = false;
					this._getEmployees();
					this.cd.detectChanges();
				});
		}
	}

	private async _getEmployees() {
		const { items } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organizationId: this.selectedContact.organizationId,
				tenantId: this.selectedContact.tenantId
			})
		);
		this.employees = items;
		if (this.selectedContact) {
			this.selectedMembers = this.selectedContact.members;
			setTimeout(() => {
				this.selectedEmployeeIds = this.selectedContact.members.map((member) => member.id);
			}, 200);
		}
	}

	onMembersSelected(members: string[]) {
		this.members = members;
		this.selectedMembers = this.filterArrayPipe.transform(this.employees, this.members);
		this.updateOrganizationContactMembers();
	}

	public async updateOrganizationContactMembers() {
		const organizationContactData: IOrganizationContactCreateInput = {
			name: this.selectedContact.name,
			organizationId: this.selectedContact.organizationId,
			id: this.selectedContact.id,
			members: this.selectedMembers,
			contactType: this.selectedContact.contactType
		};

		await this.organizationContactService.update(this.selectedContact.id, organizationContactData);
	}

	/**
	 * Handle favorite toggle event
	 */
	onFavoriteToggled(_event: { isFavorite: boolean; favorite?: IFavorite }): void {
		// The FavoriteToggleComponent already shows success/error messages
		// Additional logic can be added here if needed (analytics, state updates, etc.)
	}
}
