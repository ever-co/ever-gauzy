import { Injector, Type } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TaskBuiltInViewEnum } from '@gauzy/contracts';
import { TASK_VIEWS_BUILT_IN_SEGMENT, TASK_VIEWS_LINK } from '../task-views-ui.constants';
import { ShortcutRegistryService } from './shortcut-registry.service';

/** Where each "go to" command leads. */
export const GO_TO_LINKS: Readonly<Record<string, string>> = {
	goTasks: '/pages/tasks/dashboard',
	goViews: TASK_VIEWS_LINK,
	goMine: `${TASK_VIEWS_LINK}/${TASK_VIEWS_BUILT_IN_SEGMENT}/${TaskBuiltInViewEnum.MINE}`,
	goThisWeek: `${TASK_VIEWS_LINK}/${TASK_VIEWS_BUILT_IN_SEGMENT}/${TaskBuiltInViewEnum.THIS_WEEK}`,
	goOverdue: `${TASK_VIEWS_LINK}/${TASK_VIEWS_BUILT_IN_SEGMENT}/${TaskBuiltInViewEnum.OVERDUE}`,
	goInbox: '/pages/inbox',
	goChat: '/pages/chat',
	goDocs: '/pages/documents',
	goHome: '/pages/dashboard',
	goProjects: '/pages/organization/projects',
	goTimesheets: '/pages/employees/timesheets',
	settingsOpen: '/pages/settings'
};

/** The dialogs the global commands open, each loaded on first use. */
export type GlobalDialog = 'help' | 'goTo';
export type GlobalDialogLoaders = Readonly<Record<GlobalDialog, () => Promise<Type<unknown>>>>;

export const GLOBAL_DIALOG_LOADERS: GlobalDialogLoaders = {
	help: () => import('./shortcut-help-dialog.component').then((m) => m.ShortcutHelpDialogComponent),
	goTo: () => import('../components/go-to-task/go-to-task-dialog.component').then((m) => m.GoToTaskDialogComponent)
};

/**
 * Registers the commands that run anywhere: the "go to" links, the `?` help (a toggle) and `G R` (go to a task by
 * reference). The dialogs load on first use. Answers the function that removes them again: it also closes a dialog
 * they opened, and one whose code is still loading then opens no more (the views went away meanwhile).
 */
export function registerGlobalShortcuts(
	injector: Injector,
	loaders: GlobalDialogLoaders = GLOBAL_DIALOG_LOADERS
): () => void {
	const registry = injector.get(ShortcutRegistryService);
	const router = injector.get(Router);
	const dialogs = injector.get(NbDialogService);
	let active = true;
	// A dialog, or the import of one under way (a second press meanwhile opens nothing more).
	const open: Record<GlobalDialog, NbDialogRef<unknown> | 'opening' | null> = { help: null, goTo: null };
	const show = (which: GlobalDialog) => {
		open[which] = 'opening';
		loaders[which]().then(
			(component) => {
				if (!active) return;
				const ref = dialogs.open(component, { closeOnEsc: true }) as NbDialogRef<unknown>;
				open[which] = ref;
				ref.onClose.subscribe(() => {
					if (open[which] === ref) open[which] = null;
				});
			},
			() => {
				if (active) open[which] = null;
			}
		);
	};

	const links = Object.fromEntries(
		Object.entries(GO_TO_LINKS).map(([commandId, link]) => [commandId, () => void router.navigateByUrl(link)])
	);

	const remove = registry.registerAll({
		...links,
		helpOpen: () => {
			const help = open.help;
			if (help === 'opening') return;
			if (help) {
				help.close();
				return;
			}
			show('help');
		},
		taskGoTo: () => {
			if (open.goTo) return;
			show('goTo');
		}
	});

	return () => {
		active = false;
		remove();
		for (const which of Object.keys(open) as GlobalDialog[]) {
			const ref = open[which];
			open[which] = null;
			if (ref && ref !== 'opening') ref.close();
		}
	};
}
