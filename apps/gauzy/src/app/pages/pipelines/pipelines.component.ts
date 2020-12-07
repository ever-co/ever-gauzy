import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IPipeline,
	ComponentLayoutStyleEnum,
	IRolePermission
} from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { filter, first, tap } from 'rxjs/operators';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { RouterEvent, NavigationEnd, Router } from '@angular/router';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './pipelines.component.html',
	selector: 'ga-pipelines',
	styleUrls: ['./pipelines.component.scss']
})
export class PipelinesComponent
	extends TranslationBaseComponent
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
					const badgeClass = row.isActive ? 'success' : 'warning';
					cell = row.isActive ? 'Active' : 'Inactive';
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
	tenantId: string;
	name: string;
	disableButton = true;
	loading: boolean;

	pipelineTable: Ng2SmartTableComponent;
	@ViewChild('pipelineTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.pipelineTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private pipelinesService: PipelinesService,
		private nbToastrService: NbToastrService,
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private store: Store,
		private router: Router,
		private readonly ngxPermissionsService: NgxPermissionsService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(
				filter(
					(permissions: IRolePermission[]) => permissions.length > 0
				),
				untilDestroyed(this)
			)
			.subscribe((data) => {
				const permissions = data.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.tenantId = this.store.user.tenantId;
					await this.updatePipelines();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
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
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.pipelineTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	async updatePipelines(): Promise<void> {
		this.loading = true;
		let { organizationId, tenantId } = this;
		organizationId = organizationId || void 0;
		tenantId = tenantId || void 0;

		await this.pipelinesService
			.getAll(['stages'], { organizationId, tenantId })
			.then(({ items }) => {
				this.pipelineData = items;
				this.pipelines.load(items);
				this.filterPipelines();
			});

		this.loading = false;
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
		const { name, organizationId, tenantId } = this;

		await this.goto({ pipeline: { name, organizationId, tenantId } });
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

	selectPipeline({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.pipeline = isSelected ? data : null;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectPipeline({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.pipelineTable && this.pipelineTable.grid) {
			this.pipelineTable.grid.dataSet['willSelect'] = 'false';
			this.pipelineTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy(): void {
		clearTimeout();
	}
}
