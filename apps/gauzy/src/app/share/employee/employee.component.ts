import { Component, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import * as moment from 'moment';

@Component({
	selector: 'ngx-employee',
	templateUrl: './employee.component.html',
	styleUrls: ['./employee.component.scss']
})
export class EmployeeComponent extends TranslationBaseComponent
	implements OnInit {
	hasEditPermission$: Observable<boolean>;
	imageUrl: string;
	imageUpdateButton: boolean;
	employee$: Observable<any>;
	hoverState: boolean;

	constructor(
		private activatedRoute: ActivatedRoute,
		readonly translateService: TranslateService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.employee$ = this.activatedRoute.data.pipe(
			map(({ employee }) => ({
				...employee,
				startedWorkOn: employee.startedWorkOn
					? moment(employee.startedWorkOn).format('MM-DD-YYYY')
					: undefined
			}))
		);

		this.hasEditPermission$ = this.store.userRolePermissions$.pipe(
			map(() =>
				this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT)
			)
		);
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
		this.imageUpdateButton = true;
	}

	async saveImage() {}

	handleImageUploadError(event: any) {}
}
