import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertComponent } from './alert.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbAlertModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
    imports: [
        CommonModule,
        NbLayoutModule,
        NbCardModule,
        NbIconModule,
        NbButtonModule,
        NbAlertModule,
        TranslateModule,
        AlertComponent
    ],
    exports: [AlertComponent]
})
export class AlertModule {}
