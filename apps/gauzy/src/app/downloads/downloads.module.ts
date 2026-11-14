import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbLayoutModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { DownloadsComponent } from './downloads.component';
import { DownloadsRoutingModule } from './downloads-routing.module';

@NgModule({
	imports: [CommonModule, NbIconModule, NbLayoutModule, TranslatePipe, DownloadsRoutingModule],
	declarations: [DownloadsComponent]
})
export class DownloadsModule {}
