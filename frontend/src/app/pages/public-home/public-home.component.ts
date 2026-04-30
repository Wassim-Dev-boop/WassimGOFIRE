import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-home.component.html',
  styleUrls: ['./public-home.component.css'],
})
export class PublicHomeComponent {
  readonly currentYear = new Date().getFullYear();

  readonly advantages = ['Securise', 'Accessible', 'Centralise', 'Tracable'];

  readonly integratedModules = [
    { title: 'GED', description: 'Documents, versions, traces et acces controles.' },
    { title: 'Evenements', description: 'Calendrier, validation et publication internes.' },
    { title: 'Invitations', description: 'Gestion des confirmations et suivi des reponses.' },
    { title: 'Reservations', description: 'Salles et equipements logistiques en disponibilite reelle.' },
    { title: 'Equipements', description: 'Suivi des ressources avec responsabilites claires.' },
    { title: 'Interventions', description: 'Demandes techniques et workflow de traitement.' },
    { title: 'Notifications', description: 'Alertes metier et journal des actions importantes.' },
    { title: 'Administration', description: 'Gestion utilisateurs, roles, permissions et workflows.' },
    { title: 'Reporting', description: 'Indicateurs reels adaptes au role connecte.' },
  ];

  readonly roleUseCases = [
    'Employe',
    'Chef hierarchique',
    'Responsable salle',
    'Responsable IT',
    'Responsable qualite',
    'Directeur DSN',
    'Administrateur',
  ];
}
