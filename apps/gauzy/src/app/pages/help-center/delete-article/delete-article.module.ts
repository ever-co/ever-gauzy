import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DeleteArticleComponent } from './delete-article.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, TranslateModule.forChild()],
	declarations: [DeleteArticleComponent],
	exports: [DeleteArticleComponent]
})
export class DeleteArticleModule {}
