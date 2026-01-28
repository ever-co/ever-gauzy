import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Angular2SmartTableModule } from 'angular2-smart-table';

import {
	NbThemeModule,
	NbLayoutModule,
	NbSidebarModule,
	NbMenuModule,
	NbIconModule,
	NbButtonModule,
	NbCardModule,
	NbActionsModule,
	NbSelectModule,
	NbToggleModule,
	NbListModule,
	NbBadgeModule,
	NbUserModule,
	NbTabsetModule,
	NbTooltipModule,
	NbProgressBarModule,
	NbSpinnerModule,
	NbContextMenuModule,
	NbInputModule,
	NbCheckboxModule,
	NbAlertModule,
	NbRouteTabsetModule,
	NbDialogModule
} from '@nebular/theme';
import { NbTablerIconsModule } from '@gauzy/ui-core/theme';
import { AgentDashboardComponent } from './agent-dashboard.component';
import { LogsPageComponent } from './logs/logs.component';
import { SyncPageComponent } from './activity-sync/activity-sync.component';
import { FilterStatusPipe } from './pipes/filter.status.pipe';
import { LocalDateParse } from './pipes/date.pipe';
import { TasksModule } from '../tasks/tasks.module';
import { StatusBadgeComponent } from './activity-sync/activity-render/status-render';
import { ActivitySyncDetailModalComponent } from './activity-sync/activity-sync-detail-modal/activity-sync-detail-modal.component';

@NgModule({
	declarations: [
		AgentDashboardComponent,
		LogsPageComponent,
		SyncPageComponent,
		StatusBadgeComponent,
		ActivitySyncDetailModalComponent
	],
	imports: [
		CommonModule,
		BrowserModule,
		BrowserAnimationsModule,
		FormsModule,
		ReactiveFormsModule,
		RouterModule,
		NbThemeModule.forRoot({ name: 'dark' }),
		NbLayoutModule,
		NbSidebarModule.forRoot(),
		NbMenuModule,
		NbIconModule,
		NbTablerIconsModule,
		NbButtonModule,
		NbCardModule,
		NbActionsModule,
		NbSelectModule,
		NbToggleModule,
		NbListModule,
		NbBadgeModule,
		NbUserModule,
		NbTabsetModule,
		NbTooltipModule,
		NbProgressBarModule,
		NbSpinnerModule,
		NbContextMenuModule,
		NbInputModule,
		NbCheckboxModule,
		NbAlertModule,
		FilterStatusPipe,
		LocalDateParse,
		NbRouteTabsetModule,
		NbDialogModule.forChild(),
		TasksModule,
		Angular2SmartTableModule
	],
	exports: [FilterStatusPipe, LocalDateParse]
})
export class AgentDashboardModule {}
