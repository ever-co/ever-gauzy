import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	PermissionsEnum,
	IPipeline,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { AppStore, Store } from '../../@core/services/store.service';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { first, takeUntil } from 'rxjs/operators';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Subscription, Subject } from 'rxjs';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { RouterEvent, NavigationEnd, Router } from '@angular/router';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';

@Component({
	templateUrl: './pipelines.component.html',
	selector: 'ga-pipelines',
	styleUrls: ['./pipelines.component.scss']
})
export class PipelinesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	smartTableSettings = {
		actions: false,
		noDataMessage: this.getTranslation('SM_TABLE.NO_RESULT'),
		columns: {
			name: {
				type: 'string',
				title: this.getTranslation('SM_TABLE.NAME')
			},
			description: {
				type: 'string',
				title: this.getTranslation('SM_TABLE.DESCRIPTION')
			},
			status: {
				filter: false,
				editor: false,
				title: this.getTranslation('SM_TABLE.STATUS'),
				type: 'custom',
				width: '15%',
				renderComponent: StatusBadgeComponent,
				valuePrepareFunction: (cell, row) => {
					let badgeClass;
					if (row.isActive) {
						badgeClass = 'success';
						cell = 'Active';
					} else {
						badgeClass = 'warning';
						cell = 'Inactive';
					}
					return {
						text: cell,
						class: badgeClass
					};
				}
			}
		}
	};

	pipelineData: IPipeline[];
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	pipelines = new LocalDataSource([] as IPipeline[]);
	viewComponentName: ComponentEnum;
	pipeline: IPipeline;
	organizationId: string;
	name: string;
	CAN_EDIT_SALES_PIPELINES = false;
	private readonly $akitaPreUpdate: AppStore['akitaPreUpdate'];
	private permissionSubscription: Subscription;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private pipelinesService: PipelinesService,
		private nbToastrService: NbToastrService,
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private appStore: AppStore,
		private store: Store,
		private router: Router
	) {
		super(translateService);
		this.$akitaPreUpdate = appStore.akitaPreUpdate;
		appStore.akitaPreUpdate = (previous, next) => {
			if (previous.selectedOrganization !== next.selectedOrganization) {
				this.organizationId = next.selectedOrganization?.id;
				// noinspection JSIgnoredPromiseFromCall
				this.updatePipelines();
			}

			return this.$akitaPreUpdate(previous, next);
		};
		this.setView();
	}

	ngOnInit() {
		this.permissionSubscription = this.store.userRolePermissions$.subscribe(
			() => {
				this.CAN_EDIT_SALES_PIPELINES = this.store.hasPermission(
					PermissionsEnum.EDIT_SALES_PIPELINES
				);
			}
		);

		if (!this.organizationId) {
			setTimeout(async () => {
				this.organizationId = this.store.selectedOrganization?.id;
				await this.updatePipelines();
			});
		}

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.PROPOSALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async updatePipelines(): Promise<void> {
		const { organizationId: value } = this;
		const organizationId = value || void 0;

		await this.pipelinesService
			.find(['stages'], { organizationId })
			.then(({ items }) => {
				this.pipelineData = items;
				this.pipelines.load(items);
				this.filterPipelines();
			});
	}

	filterPipelines(): void {
		setTimeout(() => {
			const { name: search = '' } = this;

			this.pipelines.setFilter([
				{
					field: 'name',
					search
				}
			]);
		});
	}

	async deletePipeline(): Promise<void> {
		const canProceed: 'ok' = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation(
						'PIPELINES_PAGE.RECORD_TYPE',
						this.pipeline
					)
				}
			})
			.onClose.toPromise();

		if ('ok' === canProceed) {
			await this.pipelinesService.delete(this.pipeline.id);
			await this.updatePipelines();
		}
	}

	async createPipeline(): Promise<void> {
		const { name, organizationId } = this;

		await this.goto({ pipeline: { name, organizationId } });
		delete this.name;
	}

	async editPipeline(): Promise<void> {
		const { pipeline } = this;

		await this.goto({ pipeline });
		delete this.name;
	}

	private async goto(context: Record<any, any>): Promise<void> {
		const dialogRef = this.dialogService.open(PipelineFormComponent, {
			context
		});
		const data = await dialogRef.onClose.pipe(first()).toPromise();
		const {
			pipeline: { id }
		} = context;

		if (data) {
			this.nbToastrService.success(
				this.getTranslation('TOASTR.TITLE.SUCCESS'),
				this.getTranslation(
					`TOASTR.MESSAGE.PIPELINE_${id ? 'UPDATED' : 'CREATED'}`
				)
			);
			await this.updatePipelines();
		}
	}

	ngOnDestroy(): void {
		this.appStore.akitaPreUpdate = this.$akitaPreUpdate;
		this.permissionSubscription.unsubscribe();
		clearTimeout();
	}
}
