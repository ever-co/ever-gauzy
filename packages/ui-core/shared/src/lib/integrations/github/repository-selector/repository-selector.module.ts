import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { RepositorySelectorComponent } from './repository-selector.component';

@NgModule({
	declarations: [RepositorySelectorComponent],
	exports: [RepositorySelectorComponent],
	imports: [CommonModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class RepositorySelectorModule {}
