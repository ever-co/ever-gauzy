import { UpdateInfo } from "electron-updater";

export interface IDesktopUpdate {
    checkUpdate(): Promise<void>;
    update(): void;
    notify(info: UpdateInfo): void;
    cancel(): void;
    get url(): string;
    set url(value: string);
}
