import { TemplateRef } from '@angular/core';

export interface Draggable {
	set templateRef(value: TemplateRef<HTMLElement>);
	get templateRef(): TemplateRef<HTMLElement>;
	set title(value: string);
	get title(): string;
	get position(): number;
	set position(value: number);
	get move(): boolean;
	set move(value: boolean);
}
