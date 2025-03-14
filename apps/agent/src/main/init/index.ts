import { InitLogger } from './logger';
import { InitApp } from './app';
import SetupTitleBar from './titlebar';
import AppIpcMain from './ipcMain';
import InitAppTranslation from './translate';
import ApplicationError from './error';

export async function InitApplication() {
	InitLogger();
	InitAppTranslation();
	SetupTitleBar();
	AppIpcMain();
	ApplicationError();
	await InitApp();
}
