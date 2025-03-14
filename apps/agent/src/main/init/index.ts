import { InitLogger } from './logger';
import { InitApp } from './app';
import SetupTitleBar from './titlebar';
import AppIpcMain from './ipcMain';
import InitAppTranslation from './translate';
import ApplicationError from './error';

export function InitApplication() {
	InitLogger();
	InitAppTranslation();
	SetupTitleBar();
	AppIpcMain();
	ApplicationError();
	InitApp();
}
