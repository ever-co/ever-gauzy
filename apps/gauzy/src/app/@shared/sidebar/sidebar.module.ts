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
	NbLayoutModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/selectors.module';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from './sidebar.component';
import { TreeModule } from 'angular-tree-component';
import { CKEditorModule } from 'ng2-ckeditor';
import { HelpCenterService } from '../../@core/services/help-center.service';

@NgModule({
	imports: [
		AddIconModule,
		CKEditorModule,
		TreeModule.forRoot(),
		NbSelectModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
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
