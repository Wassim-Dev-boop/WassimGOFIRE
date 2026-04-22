import { Component } from '@angular/core';
import { ModalService } from '../../../services/modal.service';

import { ButtonComponent } from '../../ui/button/button.component';
import { LabelComponent } from '../../form/label/label.component';
import { ModalComponent } from '../../ui/modal/modal.component';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-user-info-card',
  imports: [
    ButtonComponent,
    LabelComponent,
    ModalComponent,
    FormsModule
],
  templateUrl: './user-info-card.component.html',
  styles: ``
})
export class UserInfoCardComponent {

  constructor(
    public modal: ModalService,
    private authService: AuthService
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (!user) {
        return;
      }

      this.user = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        bio: user.department || '',
        social: {
          facebook: 'https://www.facebook.com/PimjoHQ',
          x: 'https://x.com/PimjoHQ',
          linkedin: 'https://www.linkedin.com/company/pimjo',
          instagram: 'https://instagram.com/PimjoHQ'
        }
      };
      this.editableUser = { ...this.user, social: { ...this.user.social } };
    });
  }

  isOpen = false;
  openModal() {
    this.editableUser = { ...this.user, social: { ...this.user.social } };
    this.isOpen = true;
  }
  closeModal() { this.isOpen = false; }

  user = {
    firstName: 'Musharof',
    lastName: 'Chowdhury',
    email: 'randomuser@pimjo.com',
    phone: '+09 363 398 46',
    bio: 'Team Manager',
    social: {
      facebook: 'https://www.facebook.com/PimjoHQ',
      x: 'https://x.com/PimjoHQ',
      linkedin: 'https://www.linkedin.com/company/pimjo',
      instagram: 'https://instagram.com/PimjoHQ',
    },
  };

  editableUser = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    social: {
      facebook: '',
      x: '',
      linkedin: '',
      instagram: '',
    },
  };

  handleSave() {
    this.user = {
      ...this.editableUser,
      social: { ...this.editableUser.social }
    };

    this.authService.updateProfile({
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
      phone: this.user.phone,
      department: this.user.bio
    });

    this.closeModal();
  }
}
