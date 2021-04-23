import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import {
	IEquipment,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { EquipmentService } from '../../@core/services/equipment.service';
import { EquipmentMutationComponent } from '../../@shared/equipment/equipment-mutation.component';
import { filter, first, tap } from 'rxjs/operators';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { Store } from '../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';
import { ImageRowComponent } from '../inventory/components/table-components/image-row.component';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './equipment.component.html',
	styleUrls: ['./equipment.component.scss']
})
export class EquipmentComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedEquipment: IEquipment;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	tags: any;
	selectedTags: any;
	equipmentsData: IEquipment[];
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	equipmentTable: Ng2SmartTableComponent;
	@ViewChild('equipmentTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.equipmentTable = content;
			this.onChangedSource();
		}
	}
	selectedOrganization: IOrganization;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private equipmentService: EquipmentService,
		private toastrService: ToastrService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganization = organization;
					this.loadSettings();
				}
			});
	}

	ngOnDestroy(): void {}

	setView() {
		this.viewComponentName = ComponentEnum.EQUIPMENT;
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
		this.equipmentTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					width: '10%',
					filter: false,
					type: 'custom',
					renderComponent: ImageRowComponent
				},
				name: {
					title: this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				type: {
					title: this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_TYPE'),
					type: 'string'
				},
				serialNumber: {
					title: this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_SN'),
					type: 'string'
				},
				manufacturedYear: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_MANUFACTURED_YEAR'
					),
					type: 'number',
					filter: false
				},
				initialCost: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_INITIAL_COST'
					),
					type: 'number',
					filter: false
				},
				currency: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_CURRENCY'
					),
					type: 'string',
					filter: false
				},
				maxSharePeriod: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_MAX_SHARE_PERIOD'
					),
					type: 'number',
					filter: false
				},
				autoApproveShare: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_AUTO_APPROVE'
					),
					type: 'custom',
					filter: false,
					renderComponent: AutoApproveComponent
				}
			}
		};
	}

	manageEquipmentSharing() {
		this.router.navigate(['/pages/organization/equipment-sharing']);
	}

	async save(selectedItem?: IEquipment) {
		if (selectedItem) {
			this.selectEquipment({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedEquipment) {
			this.selectedTags = this.selectedEquipment.tags;
		} else {
			this.selectedTags = [];
		}
		const dialog = this.dialogService.open(EquipmentMutationComponent, {
			context: {
				equipment: this.selectedEquipment,
				tags: this.selectedTags,
				selectedOrganization: this.selectedOrganization
			}
		});
		const equipment = await dialog.onClose.pipe(first()).toPromise();
		this.clearItem();

		if (equipment) {
			this.toastrService.success('EQUIPMENT_PAGE.EQUIPMENT_SAVED', {
				name: equipment.name
			});
		}

		this.loadSettings();
	}

	async delete(selectedItem?: IEquipment) {
		if (selectedItem) {
			this.selectEquipment({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.equipmentService.delete(this.selectedEquipment.id);
			this.loadSettings();
			this.toastrService.success('EQUIPMENT_PAGE.EQUIPMENT_DELETED', {
				name: this.selectedEquipment.name
			});
		}
		this.clearItem();
	}

	async loadSettings() {
		const { tenantId } = this.store.user;
		const { items } = await this.equipmentService.getAll(
			['equipmentSharings', 'tags', 'image'],
			{ organizationId: this.selectedOrganization.id, tenantId }
		);

		this.loading = false;
		this.equipmentsData = items;
		this.smartTableSource.load(items);
	}

	async selectEquipment({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedEquipment = isSelected ? data : null;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectEquipment({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.equipmentTable && this.equipmentTable.grid) {
			this.equipmentTable.grid.dataSet['willSelect'] = 'false';
			this.equipmentTable.grid.dataSet.deselectAll();
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}
}
