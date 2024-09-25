import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { LanguageModule } from '../../language/language.module';
import { TaskCacheService } from '../../services';
import { ProjectSelectorModule } from '../../shared/features/project-selector/project-selector.module';
import { TaskSelectorModule } from '../../shared/features/task-selector/task-selector.module';
import { TeamSelectorModule } from '../../shared/features/team-selector/team-selector.module';
import { NoDataMessageModule } from '../no-data-message/no-data-message.module';
import { PaginationModule } from '../pagination/pagination.module';
import { TaskTableQuery } from './+state/task-table.query';
import { TaskTableStore } from './+state/task-table.store';
import { ActionButtonQuery } from './action-button/+state/action-button.query';
import { ActionButtonStore } from './action-button/+state/action-button.store';
import { ActionButtonComponent } from './action-button/action-button.component';
import { SearchTermQuery } from './search/+state/search-term.query';
import { SearchTermStore } from './search/+state/search-term.store';
import { SearchComponent } from './search/search.component';
import { TaskTableComponent } from './table/task-table.component';

@NgModule({
	declarations: [TaskTableComponent, SearchComponent, ActionButtonComponent],
	exports: [TaskTableComponent],
	imports: [
		CommonModule,
		PaginationModule,
		NbButtonModule,
		NbTooltipModule,
		NbIconModule,
		NbCardModule,
		NbFormFieldModule,
		NoDataMessageModule,
		NbInputModule,
		TaskSelectorModule,
		ProjectSelectorModule,
		TeamSelectorModule,
		LanguageModule.forChild(),
		Angular2SmartTableModule,
		NbSpinnerModule
	],
	providers: [
		ActionButtonStore,
		SearchTermStore,
		TaskTableStore,
		ActionButtonQuery,
		SearchTermQuery,
		TaskTableQuery,
		TaskCacheService
	]
})
export class TaskTableModule {}
