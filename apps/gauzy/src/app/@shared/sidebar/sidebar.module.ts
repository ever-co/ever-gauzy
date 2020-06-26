import { AddCategoryModule } from './add-category/add-category.module';
import { AddBaseModule } from './add-base/add-base.module';
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
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/selectors.module';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from './sidebar.component';
import { TreeModule } from 'angular-tree-component';
import { CKEditorModule } from 'ng2-ckeditor';
import { HelpCenterService } from '../../@core/services/help-center.service';
import { EditBaseModule } from './edit-base/edit-base.module';
import { EditCategoryModule } from './edit-category/edit-category.module';
import { DeleteCategoryModule } from './delete-category/delete-category.module';
import { DeleteBaseModule } from './delete-base/delete-base.module';

@NgModule({
	imports: [
		AddBaseModule,
		AddIconModule,
		EditBaseModule,
		DeleteBaseModule,
		AddCategoryModule,
		EditCategoryModule,
		DeleteCategoryModule,
		CKEditorModule,
		NbActionsModule,
		NbContextMenuModule,
		TreeModule.forRoot(),
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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [HelpCenterService],
	declarations: [SidebarComponent],
	exports: [SidebarComponent]
})
export class SidebarModule {}
