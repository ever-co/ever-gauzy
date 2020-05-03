import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { ActivatedRoute, Router } from '@angular/router';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { EmployeesService } from '../../@core/services';
import { TranslateService } from '@ngx-translate/core';
import { Organization, PermissionsEnum } from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { PublicPageMutationComponent } from '../../@shared/organizations/public-page-mutation/public-page-mutation.component';

@Component({
	selector: 'ngx-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: Organization;
	hasEditPermission = false;
	private _ngDestroy$ = new Subject<void>();

	loading = true;
	imageUrl: string;
	hoverState: boolean;
	imageUpdateButton: boolean = false;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private toastrService: NbToastrService,
		private employeesService: EmployeesService,
		private store: Store,
		private dialogService: NbDialogService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
		this.imageUpdateButton = true;
	}

	handleImageUploadError(event: any) {}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.PUBLIC_PAGE_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const profileLink = params.link;

				try {
					this.organization = await this.organizationsService
						.getByProfileLink(profileLink)
						.pipe(first())
						.toPromise();
					this.imageUrl = this.organization.imageUrl;
					console.log(this.organization);
				} catch (error) {
					await this.router.navigate(['/share/404']);
				}
			});
	}

	async saveImage(organization: any) {
		await this.organizationsService.update(
			this.organization.id,
			organization
		);
		this.imageUpdateButton = false;
		this.toastrService.primary('The image has been updated.', 'Success');
	}

	async editPage() {
		this.dialogService
			.open(PublicPageMutationComponent, {
				context: {
					organization: this.organization
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (!!result) {
					console.log(result.skills);
					// result.skills = result.skills.map(skill => skill.id);
					console.log(result);
					// delete result.skills;
					await this.organizationsService.update(
						this.organization.id,
						result
					);
					// delete result.skills;
					Object.assign(this.organization, result);
					this.toastrService.primary(
						this.organization.name + ' page is updated.',
						'Success'
					);
				}
			});
	}

	ngOnDestroy() {}
}
