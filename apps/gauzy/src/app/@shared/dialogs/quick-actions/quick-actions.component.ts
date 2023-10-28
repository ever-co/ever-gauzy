import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef, NbMenuItem, NbMenuService } from '@nebular/theme';
import { TimeTrackerService } from '../../time-tracker/time-tracker.service';
import { TimeLogType } from 'packages/contracts/dist';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base';

type GroupType = {
	groupTitle: string;
	items: any[];
};

type GroupQuickActionsType = {
	accounting: {
		groupTitle: string;
		items: NbMenuItem[];
	};
	time_tracking: {
		groupTitle: string;
		items: NbMenuItem[];
	};
	jobs: {
		groupTitle: string;
		items: NbMenuItem[];
	};
	pm: {
		groupTitle: string;
		items: NbMenuItem[];
	};
	contacts: {
		groupTitle: string;
		items: NbMenuItem[];
	};
	organization: {
		groupTitle: string;
		items: NbMenuItem[];
	};
};

const quickActionsCollection = {
	accounting: [
		'QUICK_ACTIONS_MENU.CREATE_INVOICE',
		'QUICK_ACTIONS_MENU.CREATE_INCOME',
		'QUICK_ACTIONS_MENU.CREATE_EXPENSE',
		'QUICK_ACTIONS_MENU.CREATE_ESTIMATE',
		'QUICK_ACTIONS_MENU.CREATE_PAYMENT',
	],
	organization: [
		'QUICK_ACTIONS_MENU.ADD_EMPLOYEE',
		'QUICK_ACTIONS_MENU.ADD_INVENTORY',
		'QUICK_ACTIONS_MENU.ADD_EQUIPMENT',
		'QUICK_ACTIONS_MENU.ADD_VENDOR',
		'QUICK_ACTIONS_MENU.ADD_DEPARTMENT',
	],
	pm: [
		'QUICK_ACTIONS_MENU.CREATE_TEAM',
		'QUICK_ACTIONS_MENU.CREATE_TASK',
		'QUICK_ACTIONS_MENU.CREATE_PROJECT',
		'QUICK_ACTIONS_MENU.VIEW_TASKS',
		'QUICK_ACTIONS_MENU.VIEW_TEAM_TASKS',
	],
	jobs: [
		'QUICK_ACTIONS_MENU.CREATE_CANDIDATE',
		'QUICK_ACTIONS_MENU.CREATE_PROPOSAL',
		'QUICK_ACTIONS_MENU.CREATE_CONTRACT',
	],
	contacts: [
		'QUICK_ACTIONS_MENU.CREATE_LEAD',
		'QUICK_ACTIONS_MENU.CREATE_CUSTOMER',
		'QUICK_ACTIONS_MENU.CREATE_CLIENT',
	],
	time_tracking: [
		'QUICK_ACTIONS_MENU.START_TIMER',
		'QUICK_ACTIONS_MENU.STOP_TIMER',
		'QUICK_ACTIONS_MENU.TIME_LOG',
	],
};

@Component({
	selector: 'ngx-quick-actions',
	templateUrl: './quick-actions.component.html',
	styleUrls: ['./quick-actions.component.scss'],
})
export class QuickActionsComponent
	extends TranslationBaseComponent
	implements OnInit
{
	@Input() items: NbMenuItem[] = [];

	groupedQuickActions: GroupType[];
	actions = {
		START_TIMER: 'START_TIMER',
		STOP_TIMER: 'STOP_TIMER',
	};

	constructor(
		private readonly dialogRef: NbDialogRef<QuickActionsComponent>,
		private readonly nbMenuService: NbMenuService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.groupedQuickActions = this._groupQuickActions(this.items);

		this.nbMenuService
			.onItemClick()
			.pipe()
			.subscribe((e) => {
				if (e.item.data && e.item.data.action) {
					switch (e.item.data.action) {
						case this.actions.START_TIMER:
							this.timeTrackerService.setTimeLogType(
								TimeLogType.TRACKED
							);
							this.timeTrackerService.openAndStartTimer();
							break;
						case this.actions.STOP_TIMER:
							this.timeTrackerService.setTimeLogType(
								TimeLogType.RESUMED
							);
							this.timeTrackerService.turnOffTimer();
					}
					return;
				}
				if (e.item.link?.length && !e.item.data?.action) {
					this.closeDialog();
				}
			});
	}

	closeDialog() {
		this.dialogRef.close();
	}

	private isBelongToGroup(groupName: string, title: string) {
		return quickActionsCollection[groupName]
			.map((action) => this.getTranslation(action))
			.includes(title);
	}

	private _groupQuickActions(items: any[]): GroupType[] {
		const groupedActions: GroupQuickActionsType = {
			accounting: {
				groupTitle: 'QUICK_ACTIONS_GROUP.ACCOUNTING',
				items: [],
			},
			time_tracking: {
				groupTitle: 'QUICK_ACTIONS_GROUP.TIME_TRACKING',
				items: [],
			},
			jobs: {
				groupTitle: 'QUICK_ACTIONS_GROUP.JOBS',
				items: [],
			},
			pm: {
				groupTitle: 'QUICK_ACTIONS_GROUP.PROJECT_MANAGEMENT',
				items: [],
			},
			contacts: {
				groupTitle: 'QUICK_ACTIONS_GROUP.CONTACTS',
				items: [],
			},
			organization: {
				groupTitle: 'QUICK_ACTIONS_GROUP.ORGANIZATION',
				items: [],
			},
		};
		items.map((item) => {
			if (this.isBelongToGroup('accounting', item.title))
				groupedActions.accounting.items.push(item);
			if (this.isBelongToGroup('time_tracking', item.title)) {
				groupedActions.time_tracking.items.push({
					...item,
					hidden: false,
				});
			}
			if (this.isBelongToGroup('jobs', item.title))
				groupedActions.jobs.items.push(item);
			if (this.isBelongToGroup('pm', item.title))
				groupedActions.pm.items.push(item);
			if (this.isBelongToGroup('contacts', item.title))
				groupedActions.contacts.items.push(item);
			if (this.isBelongToGroup('organization', item.title))
				groupedActions.organization.items.push(item);
			return item;
		});
		const finalData = Object.values(groupedActions).sort(
			(a, b) => b.items?.length - a.items?.length
		);
		return finalData;
	}
}
