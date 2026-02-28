import { NgModule } from '@angular/core';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbDialogModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbRadioModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';

/**
 * Common Nebular modules used across multiple UI plugins.
 *
 * Import `NebularModule` instead of listing individual `Nb*Module`
 * imports in every plugin / feature module.
 *
 * Modules that require `.forRoot()` or `.forChild()` configuration
 * (e.g. `NbDialogModule.forChild()`) are included with `.forChild()`
 * so this module is safe to import in lazy-loaded feature modules.
 */
const NB_MODULES = [
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbRadioModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
];

@NgModule({
	imports: [...NB_MODULES, NbDialogModule.forChild()],
	exports: [...NB_MODULES, NbDialogModule]
})
export class NebularModule {}
