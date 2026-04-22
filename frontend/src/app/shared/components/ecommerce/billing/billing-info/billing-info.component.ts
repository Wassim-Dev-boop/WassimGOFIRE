import { Component } from '@angular/core';
import { ModalComponent } from '../../../ui/modal/modal.component';
import { ButtonComponent } from '../../../ui/button/button.component';
import { Option, SelectComponent } from '../../../form/select/select.component';

@Component({
  selector: 'app-billing-info',
  imports: [
    ModalComponent,
    ButtonComponent,
    SelectComponent,
  ],
  templateUrl: './billing-info.component.html',
  host: {
    class: 'rounded-2xl border border-gray-200 bg-white xl:w-2/6 dark:border-gray-800 dark:bg-white/[0.03]',
  },
})
export class BillingInfoComponent {

  isOpen = false;
  selectedCountry = '';
  selectedCity = '';

  readonly countryOptions: Option[] = [
    { value: 'USA', label: 'USA' },
    { value: 'UK', label: 'UK' },
    { value: 'BD', label: 'BD' },
    { value: 'EU', label: 'EU' },
    { value: 'ID', label: 'ID' },
  ];

  readonly cityOptions: Option[] = [
    { value: 'New York', label: 'New York' },
    { value: 'Tokyo', label: 'Tokyo' },
    { value: 'Chicago', label: 'Chicago' },
    { value: 'Los Angels', label: 'Los Angels' },
    { value: 'Berlin', label: 'Berlin' },
  ];

  openModal() {
    this.isOpen = true;
  }

  closeModal() {
    this.isOpen = false;
  }

  handleSave ()  {
    // Handle save logic here
    console.log("Saving changes...");
    this.closeModal();
  };
}
