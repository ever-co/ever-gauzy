import { Component, OnInit, AfterViewInit, Input } from '@angular/core';
import { Validators, FormBuilder } from '@angular/forms';

@Component({
    selector: 'ga-user-basic-info-form',
    templateUrl: 'basic-info-form.component.html',
})
export class BasicInfoFormComponent implements OnInit, AfterViewInit {
    readonly form = this.fb.group({
        username: [''],
        firstName: [''],
        lastName: [''],
        email: ['', Validators.compose( [Validators.required, Validators.email])],
        imageUrl: ['', Validators.compose( [Validators.pattern(new RegExp(`(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))`, 'g'))])],
        password: ['', Validators.compose([Validators.required, Validators.minLength(4)])]
    });

    username = this.form.get('username');
    firstName = this.form.get('firstName');
    lastName = this.form.get('lastName');
    email = this.form.get('email');
    imageUrl = this.form.get('imageUrl');
    password = this.form.get('password');
    off: string;

    constructor(
        private readonly fb: FormBuilder
    ) { }

    ngAfterViewInit(): void {
        console.warn('BasicInfoFormComponent');

    }
    ngOnInit(): void {
        console.warn('BasicInfoFormComponent');
    }
}