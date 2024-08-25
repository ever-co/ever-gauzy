import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbToggleModule } from '@nebular/theme'; // Import Nebular Toggle Module
import { TranslateModule } from '@ngx-translate/core'; // Import ngx-translate Module

import { SwitchThemeComponent } from './switch-theme.component';

@NgModule({
    declarations: [SwitchThemeComponent],
    imports: [
        CommonModule,
        NbToggleModule,
        TranslateModule
    ],
    exports: [SwitchThemeComponent]
})
export class SwitchThemeModule { }
