import { app } from 'electron';
import {
	ErrorEventManager,
	ErrorReport,
	ErrorReportRepository,
	DialogErrorHandler
} from '@gauzy/desktop-lib';
const report = new ErrorReport(new ErrorReportRepository(process.env.REPO_OWNER, process.env.REPO_NAME));
const eventErrorManager = ErrorEventManager.instance;

export default function ApplicationError() {
	eventErrorManager.onSendReport(async (message) => {
		const dialog = new DialogErrorHandler(message);
		dialog.options.buttons.shift();
		const button = await dialog.show();
		switch (button.response) {
			case 0:
				report.description = message;
				await report.submit();
				app.exit(0);
				break;
			default:
				app.exit(0);
				break;
		}
	});

	eventErrorManager.onShowError(async (message) => {
		const dialog = new DialogErrorHandler(message);
		dialog.options.buttons.splice(1, 1);
		const button = await dialog.show();
		switch (button.response) {
			case 1:
				app.exit(0);
				break;
			default:
				// 👀
				break;
		}
	});
}

