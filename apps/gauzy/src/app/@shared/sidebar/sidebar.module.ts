import { AddIconModule } from './add-icon/add-icon.module';
import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbSidebarModule,
	NbLayoutModule,
	NbActionsModule,
	NbContextMenuModule
} from '@nebular/theme';
import { SidebarComponent } from './sidebar.component';
import { TreeModule } from '@ali-hm/angular-tree-component';
import { CKEditorModule } from 'ckeditor4-angular';
import { HelpCenterService } from '@gauzy/ui-sdk/core';
import { KnowledgeBaseModule } from './knowledeg-base/knowledeg-base.module';
import { DeleteCategoryModule } from './delete-category/delete-category.module';
import { DeleteBaseModule } from './delete-base/delete-base.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [
		AddIconModule,
		KnowledgeBaseModule,
		DeleteBaseModule,
		DeleteCategoryModule,
		CKEditorModule,
		NbActionsModule,
		NbContextMenuModule,
		TreeModule,
		NbSelectModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbLayoutModule,
		NbSidebarModule.forRoot(),
		I18nTranslateModule.forChild()
	],
	providers: [HelpCenterService],
	declarations: [SidebarComponent],
	exports: [SidebarComponent]
})
export class SidebarModule {}
