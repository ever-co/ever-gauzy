import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
@Component({
    selector: 'ngx-tags-mutation',
    templateUrl: './tags-mutation.component.html',
    styleUrls: ['./tags-mutation.component.scss']
})
 
export class TagsMutationComponent implements OnInit{

    constructor(
        protected dialogRef: NbDialogRef<TagsMutationComponent>,
    ){}
    ngOnInit(){

    }
}