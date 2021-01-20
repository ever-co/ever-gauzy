import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { DeleteArticleComponent } from './delete-article.component';
import { TranslaterModule } from '../../../@shared/translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslaterModule
	],
	entryComponents: [DeleteArticleComponent],
	declarations: [DeleteArticleComponent],
	exports: [DeleteArticleComponent]
})
export class DeleteArticleModule {}
