import { NgModule } from '@angular/core';
import { Pipes } from './index';

@NgModule({
	declarations: [...Pipes],
	exports: [...Pipes],
	providers: [...Pipes]
})
export class PipesModule {}
