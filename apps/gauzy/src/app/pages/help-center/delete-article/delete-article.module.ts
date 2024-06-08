import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { DeleteArticleComponent } from './delete-article.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbIconModule, NbButtonModule, I18nTranslateModule.forChild()],
	declarations: [DeleteArticleComponent],
	exports: [DeleteArticleComponent]
})
export class DeleteArticleModule {}
