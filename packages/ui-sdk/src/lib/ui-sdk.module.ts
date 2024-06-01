import { NgModule } from '@angular/core';
import { CoreModule } from './core/src/core.module';
import { ThemeModule } from './theme/src/theme.module';

@NgModule({
	declarations: [],
	imports: [ThemeModule, CoreModule],
	exports: [],
	providers: []
})
export class UiSdkModule {}
