import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder } from '@angular/forms';

@Component({
    selector: 'ngx-edit-employee-profile',
    templateUrl: './edit-employee-profile.component.html',
    styleUrls: ['./edit-employee-profile.component.scss']
})
export class EditEmployeeProfileComponent implements OnInit {
    protected form = this.fb.group({
        username: [''],
        email: [''],
        department: ['']
    })

    constructor(private route: ActivatedRoute,
                private router: Router,
                private fb: FormBuilder) { }

    ngOnInit() {
        this.route.params.subscribe(params => {
            const { id } = params;


        })
    }

}
