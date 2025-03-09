import { app } from 'electron';
import { logger as log, store } from '@gauzy/desktop-core';
import * as Sentry from '@sentry/electron';
import { initSentry } from '../../sentry';
import * as path from 'path';
import { DialogErrorHandler } from '@gauzy/desktop-lib';

export function InitLogger() {
	log.setup();

	// Add node modules path
	log.info('Gauzy Agent Node Modules Path', path.join(__dirname, 'node_modules'));

	// Initialize Sentry
	initSentry();

	log.catchErrors({
		showDialog: false,
		onError(error, versions, submitIssue) {
			// Set user information, as well as tags and further extras
			const scope = new Sentry.Scope();
			scope.setExtra('Version', versions.app);
			scope.setTag('OS', versions.os);
			// Capture exceptions, messages
			Sentry.captureMessage(error.message);
			Sentry.captureException(new Error(error.stack), scope);
			const dialog = new DialogErrorHandler(error.message);
			dialog.options.detail = error.stack;
			dialog.show().then((result) => {
				if (result.response === 1) {
					submitIssue(`https://github.com/${process.env.REPO_OWNER}/${process.env.REPO_NAME}/issues/new`, {
						title: `Automatic error report for Desktop Timer App ${versions.app}`,
						body: 'Error:\n```' + error.stack + '\n```\n' + `OS: ${versions.os}`
					});
					return;
				}

				if (result.response === 2) {
					app.quit();
					return;
				}
				return;
			});
		}
	});
}
