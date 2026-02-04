import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule, NbLayoutModule, NbSpinnerModule } from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { LanguageModule } from '../language/language.module';
import { SplashScreenComponent } from './splash-screen.component';

@NgModule({
    imports: [
        CommonModule,
        NbLayoutModule,
        NbCardModule,
        NbSpinnerModule,
        NbButtonModule,
        DesktopDirectiveModule,
        NbIconModule,
        LanguageModule.forChild(),
        SplashScreenComponent
    ],
    exports: [SplashScreenComponent],
    providers: []
})
export class SplashScreenModule {}
