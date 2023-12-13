import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbListModule } from '@nebular/theme';
import { TranslateModule } from './../../../@shared/translate/translate.module';
import { ThemeModule } from './../../../@theme/theme.module';
import { SharedModule } from './../../../@shared/shared.module';
import { WorkspaceSelectionComponent } from './workspace-selection.component';

@NgModule({
    imports: [
        CommonModule,
        NbCardModule,
        NbIconModule,
        NbListModule,
        TranslateModule,
        ThemeModule,
        SharedModule
    ],
    declarations: [
        WorkspaceSelectionComponent
    ],
    exports: [
        WorkspaceSelectionComponent
    ],
    providers: []
})
export class WorkspaceSelectionModule { }
