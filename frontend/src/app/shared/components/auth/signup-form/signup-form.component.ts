import { Component } from '@angular/core';
import { LabelComponent } from '../../form/label/label.component';
import { CheckboxComponent } from '../../form/input/checkbox.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-signup-form',
  imports: [
    CommonModule,
    LabelComponent,
    CheckboxComponent,
    InputFieldComponent,
    RouterModule,
    FormsModule
],
  templateUrl: './signup-form.component.html',
  styles: ``
})
export class SignupFormComponent {

  showPassword = false;
  isChecked = false;
  isSubmitting = false;

  fname = '';
  lname = '';
  email = '';
  password = '';
  signUpError = '';
  signUpSuccess = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onFirstNameChange(value: string | number): void {
    this.fname = String(value);
  }

  onLastNameChange(value: string | number): void {
    this.lname = String(value);
  }

  onEmailChange(value: string | number): void {
    this.email = String(value);
  }

  onPasswordChange(value: string | number): void {
    this.password = String(value);
  }

  onSignUp() {
    if (this.isSubmitting) {
      return;
    }

    if (!this.fname.trim() || !this.lname.trim() || !this.email.trim() || !this.password.trim()) {
      this.signUpError = 'Tous les champs obligatoires doivent etre renseignes.';
      return;
    }

    this.signUpError = '';
    this.signUpSuccess = '';
    this.isSubmitting = true;

    this.authService.signUp(this.fname, this.lname, this.email, this.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.signUpSuccess = 'Compte cree avec succes. Connectez-vous maintenant.';
        this.password = '';
        void this.router.navigate(['/signin'], { queryParams: { registered: '1' } });
      },
      error: (error: Error) => {
        this.isSubmitting = false;
        this.signUpError = error.message || 'Echec de creation du compte.';
      },
    });
  }
}
