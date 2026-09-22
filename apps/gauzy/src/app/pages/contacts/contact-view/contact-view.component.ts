import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	BaseEntityEnum,
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

	/** Entity type the record-side Documents tab attaches its links to. */
	readonly documentEntity = BaseEntityEnum.OrganizationContact;

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

	/**
	 * The contact's initials, shown in place of a picture.
	 *
	 * An `<img>` bound to a missing `imageUrl` renders the browser's broken-image
	 * glyph, which is what the header used to show for every contact without one.
	 */
	get initials(): string {
		return (this.selectedContact?.name ?? '')
			.split(/\s+/)
			.filter((part: string) => !!part)
			.slice(0, 2)
			.map((part: string) => part.charAt(0).toUpperCase())
			.join('');
	}

	private _init(id: string) {
		if (id) {
			const { tenantId } = this.store.user;
			this.organizationContactService
				.getById(id, tenantId, ['projects', 'members', 'members.user', 'tags', 'contact'])
				.then((items) => {
					if (items) {
						this.selectedContact = items;
						// `contact` is the ADDRESS relation and is genuinely optional: reading
						// through it unguarded threw, the rejection landed in the `catch` below,
						// and a contact with no address rendered as a blank page.
						const latitude = this.selectedContact.contact?.latitude;
						const longitude = this.selectedContact.contact?.longitude;
						setTimeout(() => {
							// The map is created ~200ms after view init and caches its size then;
							// the address block above it has usually grown by now, so it has to be
							// re-measured or the tiles sit offset inside the frame.
							this.leafletTemplate?.invalidateSize();
							if (latitude && longitude) {
								this.leafletTemplate?.addMarker(new LatLng(latitude, longitude));
							}
						}, 200);
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
		// Runs from `finally`, i.e. also on the failure path where there is no
		// contact to read an organization from.
		if (!this.selectedContact) {
			return;
		}
		const { items } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organizationId: this.selectedContact.organizationId,
				tenantId: this.selectedContact.tenantId
			})
		);
		this.employees = items;
		this.selectedMembers = this.selectedContact.members ?? [];
		setTimeout(() => {
			this.selectedEmployeeIds = (this.selectedContact?.members ?? []).map((member) => member.id);
		}, 200);
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
