import { UpdateInfo } from "electron-updater";

export interface IDesktopUpdate {
    checkUpdate(): void;
    update(): void;
    notify(info: UpdateInfo): void;
    cancel(): void;
    get url(): string;
    set url(value: string);
}
