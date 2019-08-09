import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
    NbCardModule,
    NbButtonModule,
    NbInputModule,
    NbIconModule,
    NbBadgeModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AuthRoutingModule } from './auth-routing.module';
import { ProfileComponent } from './profile/profile.component';
import { ImageUpladerModule } from '../../@shared/image-uploader/image-uploader.module';
import { RoleService } from '../../@core/services/role.service';

export function HttpLoaderFactory(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
    imports: [
        AuthRoutingModule,
        ThemeModule,
        NbCardModule,
        NgSelectModule,
        ReactiveFormsModule,
        FormsModule,
        NbButtonModule,
        NbInputModule,
        NbIconModule,
        TranslateModule.forChild({
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient]
            }
        }),
        ImageUpladerModule,
        NbBadgeModule
    ],
    declarations: [
        ProfileComponent
    ],
    providers: [RoleService]
})
export class AuthModule { }