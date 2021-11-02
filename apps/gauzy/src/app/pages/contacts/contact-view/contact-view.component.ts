import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IEmployee, IOrganization, IOrganizationContact, IOrganizationContactCreateInput } from '@gauzy/contracts';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { LatLng } from 'leaflet';
import { firstValueFrom } from 'rxjs';
import {
	EmployeesService,
	OrganizationContactService,
	Store,
	ToastrService
} from '../../../@core/services';
import { LeafletMapComponent } from '../../../@shared/forms';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FilterArrayPipe } from '../../../@shared/pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-contact-view',
	templateUrl: './contact-view.component.html',
	styleUrls: ['./contact-view.component.scss']
})
export class ContactViewComponent
	extends TranslationBaseComponent
	implements OnInit {
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
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly cd: ChangeDetectorRef,
		private readonly employeesService: EmployeesService,
		private readonly filterArrayPipe: FilterArrayPipe,
	) {
		super(translateService);
	}

	ngOnInit(): void {
		const contactId = this.activatedRoute.snapshot.params.id;
		this._init(contactId);
	}

	private _init(id: string) {
		if (id) {
			const { tenantId } = this.store.user;
			this.organizationContactService
				.getById(id,
					tenantId,
					['projects', 'members', 'members.user', 'tags', 'contact'])
				.then((items) => {
					if (items) {
						this.selectedContact = items;
						if (this.selectedContact.contact.latitude && this.selectedContact.contact.longitude) {
							setTimeout(() => {
								this.leafletTemplate
									.addMarker(new LatLng(
										this.selectedContact.contact.latitude,
										this.selectedContact.contact.longitude
									));
							}, 200);
						}
					}
				})
				.finally(() => {
					this.loading = false;
					this._getEmployees()
					this.cd.detectChanges();
				});
		}
	}

	private async _getEmployees() {
		const { items } = await firstValueFrom(this.employeesService
			.getAll(['user'], {
				organizationId: this.selectedContact.organizationId,
				tenantId: this.selectedContact.tenantId
			}));
		this.employees = items;
		if (this.selectedContact) {
			this.selectedMembers = this.selectedContact.members;
			setTimeout(() => {
				this.selectedEmployeeIds = this.selectedContact.members.map(
					(member) => member.id
				);
			}, 200);
		}		
	}

	onMembersSelected(members: string[]) {
		this.members = members;
		this.selectedMembers = this.filterArrayPipe.transform(
			this.employees,
			this.members
		);
		this.updateOrganizationContactMembers();
	}

	public async updateOrganizationContactMembers() {
		const organizationContactData: IOrganizationContactCreateInput = {
			name: this.selectedContact.name,
			organizationId: this.selectedContact.organizationId,
			id: this.selectedContact.id,
			members: this.selectedMembers
		};

		await this.organizationContactService.create(organizationContactData);
	}
}
