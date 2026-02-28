import { NgModule } from '@angular/core';
import { Pipes } from './index';

@NgModule({
	imports: [...Pipes],
	exports: [...Pipes],
	providers: [...Pipes]
})
export class PipesModule {}
