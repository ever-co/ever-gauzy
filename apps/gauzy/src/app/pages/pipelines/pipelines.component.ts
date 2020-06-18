import { Component, OnDestroy, OnInit } from '@angular/core';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';
import { PermissionsEnum, Pipeline } from '@gauzy/models';
import { AppStore, Store } from '../../@core/services/store.service';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { first } from 'rxjs/operators';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { AuthService } from '../../@core/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
	templateUrl: './pipelines.component.html',
	selector: 'ga-pipelines'
})
export class PipelinesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	public smartTableSettings = {
		actions: false,
		noDataMessage: this.getTranslation('SM_TABLE.NO_RESULT'),
		columns: {
			name: {
				filter: false,
				editor: false,
				title: this.getTranslation('SM_TABLE.NAME')
			},
			description: {
				filter: false,
				editor: false,
				title: this.getTranslation('SM_TABLE.DESCRIPTION')
			}
		}
	};
	public pipelines = new LocalDataSource([] as Pipeline[]);
	public CAN_EDIT_SALES_PIPELINES = false;
	public organizationId: string;
	public pipeline: Pipeline;
	public name: string;

	private readonly $akitaPreUpdate: AppStore['akitaPreUpdate'];
	private permissionSubscription: Subscription;

	public constructor(
		private usersOrganizationsService: UsersOrganizationsService,
		private pipelinesService: PipelinesService,
		private nbToastrService: NbToastrService,
		private dialogService: NbDialogService,
		translateService: TranslateService,
		private authService: AuthService,
		private appStore: AppStore,
		private store: Store
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
	}

	public ngOnInit(): void {
		this.permissionSubscription = this.store.userRolePermissions$.subscribe(
			() => {
				this.CAN_EDIT_SALES_PIPELINES = this.store.hasPermission(
					PermissionsEnum.EDIT_SALES_PIPELINES
				);
				console.log({
					CAN_EDIT_SALES_PIPELINES: this.CAN_EDIT_SALES_PIPELINES
				});
			}
		);

		if (!this.organizationId) {
			setTimeout(async () => {
				this.organizationId = this.store.selectedOrganization?.id;
				await this.updatePipelines();
			});
		}
	}

	public ngOnDestroy(): void {
		this.appStore.akitaPreUpdate = this.$akitaPreUpdate;
		this.permissionSubscription.unsubscribe();
	}

	public async updatePipelines(): Promise<void> {
		const { organizationId: value } = this;
		const organizationId = value || void 0;

		await this.pipelinesService
			.find(['stages'], { organizationId })
			.then(({ items }) => {
				this.pipelines.load(items);
				this.filterPipelines();
			});
	}

	public filterPipelines(): void {
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

	public async deletePipeline(): Promise<void> {
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

	public async createPipeline(): Promise<void> {
		const { name, organizationId } = this;

		await this.goto({ pipeline: { name, organizationId } });
		delete this.name;
	}

	public async editPipeline(): Promise<void> {
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
}
