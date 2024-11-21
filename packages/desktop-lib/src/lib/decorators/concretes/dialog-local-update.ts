import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';
import { IDesktopDialog, IDesktopOpenDialog } from '../../interfaces';
import { dialog, OpenDialogSyncOptions } from 'electron';
export class DialogLocalUpdate extends BaseDesktopDialogDecorator implements IDesktopOpenDialog {
    private _options: OpenDialogSyncOptions;
    constructor(dialog: IDesktopDialog) {
        super(dialog);
        this._options = {
            properties: ['openDirectory'],
            title: this.options.title,
            message: this.options.message
        }
    }
    public open(): string[] {
        return dialog.showOpenDialogSync(this.browserWindow, this._options);
    }
}
