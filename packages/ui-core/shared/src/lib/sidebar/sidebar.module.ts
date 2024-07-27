import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbContextMenuModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbSelectModule,
	NbSidebarModule
} from '@nebular/theme';
import { TreeModule } from '@ali-hm/angular-tree-component';
import { CKEditorModule } from 'ckeditor4-angular';
import { TranslateModule } from '@ngx-translate/core';
import { HelpCenterService } from '@gauzy/ui-core/core';
import { AddIconModule } from './add-icon/add-icon.module';
import { SidebarComponent } from './sidebar.component';
import { KnowledgeBaseModule } from './knowledeg-base/knowledeg-base.module';
import { DeleteCategoryModule } from './delete-category/delete-category.module';
import { DeleteBaseModule } from './delete-base/delete-base.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		CKEditorModule,
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbContextMenuModule,
		NbIconModule,
		NbInputModule,
		NbLayoutModule,
		NbSelectModule,
		NbSidebarModule.forRoot(),
		TreeModule,
		TranslateModule.forChild(),
		AddIconModule,
		KnowledgeBaseModule,
		DeleteBaseModule,
		DeleteCategoryModule
	],
	providers: [HelpCenterService],
	declarations: [SidebarComponent],
	exports: [SidebarComponent]
})
export class SidebarModule {}
