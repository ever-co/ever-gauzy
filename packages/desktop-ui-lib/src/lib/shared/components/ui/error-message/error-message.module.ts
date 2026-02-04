import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ErrorMessageComponent } from './error-message.component';

@NgModule({
    exports: [ErrorMessageComponent],
    imports: [CommonModule, ErrorMessageComponent]
})
export class ErrorMessageModule {}
