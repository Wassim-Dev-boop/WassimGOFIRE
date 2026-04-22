import { Component, OnInit } from '@angular/core';
import { LabelComponent } from '../../form/label/label.component';
import { CheckboxComponent } from '../../form/input/checkbox.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signin-form',
  imports: [
    CommonModule,
    LabelComponent,
    CheckboxComponent,
    ButtonComponent,
    InputFieldComponent,
    RouterModule,
    FormsModule
],
  templateUrl: './signin-form.component.html',
  styles: ``
})
export class SigninFormComponent implements OnInit {

  showPassword = false;
  isChecked = false;
  isSubmitting = false;

  identifier = '';
  password = '';
  signInError = '';
  infoMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.infoMessage = params.get('registered') === '1'
        ? 'Compte cree avec succes. Vous pouvez maintenant vous connecter.'
        : '';
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onIdentifierChange(value: string | number): void {
    this.identifier = String(value);
  }

  onPasswordChange(value: string | number): void {
    this.password = String(value);
  }

  onSignIn() {
    if (this.isSubmitting) {
      return;
    }

    if (!this.identifier.trim() || !this.password.trim()) {
      this.signInError = 'Identifiant et mot de passe obligatoires.';
      return;
    }

    this.isSubmitting = true;
    this.signInError = '';

    this.authService
      .signIn(this.identifier, this.password)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          void this.router.navigate(['/dashboard']);
        },
        error: (error: Error) => {
          this.isSubmitting = false;
          this.signInError = error.message || 'Echec de connexion.';
        },
      });
  }
}
