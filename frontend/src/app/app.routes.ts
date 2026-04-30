import { Routes } from '@angular/router';
import { ProfileComponent } from './pages/profile/profile.component';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { SignInComponent } from './pages/auth-pages/sign-in/sign-in.component';
import { SignUpComponent } from './pages/auth-pages/sign-up/sign-up.component';
import { ForgotPasswordComponent } from './pages/auth-pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/auth-pages/reset-password/reset-password.component';
import { PublicHomeComponent } from './pages/public-home/public-home.component';

// Modules metier
import { EnterpriseDashboardComponent } from './pages/dashboard/enterprise-dashboard/enterprise-dashboard.component';
import { GedListComponent } from './modules/ged/components/ged-list.component';
import { EventsListComponent } from './modules/events/components/events-list.component';
import { EventAlbumComponent } from './modules/events/components/event-album.component';
import { InvitationsComponent } from './modules/events/components/invitations.component';
import { RoomReservationsComponent } from './modules/reservations/components/room-reservations.component';
import { EquipmentReservationsComponent } from './modules/reservations/components/equipment-reservations.component';
import { NotificationsComponent } from './modules/notifications/components/notifications.component';
import { InterventionsComponent } from './modules/interventions/components/interventions.component';
import { ItEquipmentComponent } from './modules/it/components/it-equipment.component';
import { ItInterventionsComponent } from './modules/it/components/it-interventions.component';
import { AdminPanelComponent } from './modules/admin/components/admin-panel.component';
import { AdminWorkflowsComponent } from './modules/admin/components/admin-workflows.component';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { AppRole } from './core/models';

const allBusinessRoles: AppRole[] = [
  'ADMIN',
  'EMPLOYEE',
  'MANAGER',
  'ROOM_MANAGER',
  'IT_MANAGER',
  'SECURITY_MANAGER',
  'DSN_DIRECTOR',
  'QUALITY_MANAGER'
];

const reservationBusinessRoles: AppRole[] = [
  'ADMIN',
  'EMPLOYEE',
  'MANAGER',
  'ROOM_MANAGER',
  'SECURITY_MANAGER',
  'DSN_DIRECTOR',
  'QUALITY_MANAGER'
];

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'accueil',
    pathMatch: 'full'
  },
  {
    path: 'accueil',
    component: PublicHomeComponent,
    title: 'Accueil | CNSTN'
  },
  // Pages d'authentification
  {
    path: 'login',
    redirectTo: 'signin',
    pathMatch: 'full'
  },
  {
    path: 'signin',
    component: SignInComponent,
    title: 'Connexion | CNSTN'
  },
  {
    path: 'signup',
    component: SignUpComponent,
    title: 'Inscription | CNSTN'
  },
  {
    path: 'inscription',
    redirectTo: 'signup',
    pathMatch: 'full'
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    title: 'Mot de passe oublie | CNSTN'
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    title: 'Reinitialisation du mot de passe | CNSTN'
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: EnterpriseDashboardComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_REPORTS_MODULE'] },
        title: 'Tableau de bord | CNSTN',
      },
      {
        path: 'reporting',
        component: EnterpriseDashboardComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_REPORTS_MODULE'] },
        title: 'Reporting | CNSTN',
      },
      {
        path: 'profile',
        component: ProfileComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles },
        title: 'Mon profil | CNSTN'
      },

      // Modules metier
      // Gestion documentaire (GED)
      {
        path: 'documents',
        component: GedListComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_GED_MODULE'] },
        title: 'Gestion documentaire | CNSTN',
      },

      // Gestion des evenements
      {
        path: 'events',
        component: EventsListComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_EVENTS_MODULE'] },
        title: 'Gestion des evenements | CNSTN',
      },
      {
        path: 'events/:id/album',
        component: EventAlbumComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_EVENTS_MODULE'] },
        title: 'Album photos evenement | CNSTN',
      },
      {
        path: 'invitations',
        component: InvitationsComponent,
        canActivate: [roleGuard],
        data: {
          roles: ['ADMIN', 'EMPLOYEE', 'MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER', 'SECURITY_MANAGER'] as AppRole[],
          permissions: ['VIEW_EVENTS_MODULE'],
        },
        title: 'Invitations | CNSTN',
      },

      // Reservations
      {
        path: 'reservations',
        redirectTo: 'reservations/salles',
        pathMatch: 'full',
      },
      {
        path: 'reservations/salles',
        component: RoomReservationsComponent,
        canActivate: [roleGuard],
        data: { roles: reservationBusinessRoles },
        title: 'Reservations des salles | CNSTN',
      },
      {
        path: 'reservations/equipements',
        component: EquipmentReservationsComponent,
        canActivate: [roleGuard],
        data: { roles: reservationBusinessRoles },
        title: 'Reservations des equipements | CNSTN',
      },

      // Interventions techniques
      {
        path: 'it/equipements',
        component: ItEquipmentComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'IT_MANAGER'] as AppRole[] },
        title: 'Parc équipements IT | CNSTN',
      },
      {
        path: 'it/interventions',
        component: ItInterventionsComponent,
        canActivate: [roleGuard],
        data: {
          roles: ['ADMIN', 'EMPLOYEE', 'MANAGER', 'DSN_DIRECTOR', 'IT_MANAGER'] as AppRole[],
          permissions: ['VIEW_INTERVENTIONS_MODULE'],
        },
        title: 'Interventions IT | CNSTN',
      },
      {
        path: 'interventions',
        component: InterventionsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'ROOM_MANAGER'] as AppRole[], permissions: ['VIEW_INTERVENTIONS_MODULE'] },
        title: 'Interventions logistiques | CNSTN',
      },

      // Notifications
      {
        path: 'notifications',
        component: NotificationsComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles },
        title: 'Notifications | CNSTN',
      },

      // Administration
      {
        path: 'admin/workflows',
        component: AdminWorkflowsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] as AppRole[], permissions: ['VIEW_USERS_MODULE'] },
        title: 'Administration des workflows | CNSTN',
      },
      {
        path: 'admin',
        component: AdminPanelComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] as AppRole[], permissions: ['VIEW_USERS_MODULE'] },
        title: 'Administration | CNSTN',
      },
    ]
  },
  // Page d'erreur
  {
    path: '**',
    component: NotFoundComponent,
    title: 'Page introuvable | CNSTN'
  },
];
