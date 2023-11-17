import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbListModule } from '@nebular/theme';
import { MultiWorkspaceOnboardingComponent } from './multi-workspace.component';
import { TranslateModule } from './../../../../@shared/translate/translate.module';
import { ThemeModule } from './../../../../@theme/theme.module';

@NgModule({
    imports: [
        CommonModule,
        NbCardModule,
        NbIconModule,
        NbListModule,
        TranslateModule,
        ThemeModule,
    ],
    declarations: [
        MultiWorkspaceOnboardingComponent
    ],
    exports: [
        MultiWorkspaceOnboardingComponent
    ],
    providers: []
})
export class MultiWorkspaceModule { }
