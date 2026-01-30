import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbAlertModule, NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsTabComponent } from './settings-tab.component';

@NgModule({
    imports: [CommonModule, TranslateModule, NbCardModule, NbButtonModule, NbIconModule, NbAlertModule, SettingsTabComponent]
})
export class SettingsTabModule { }
