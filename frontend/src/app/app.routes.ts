import { Routes } from '@angular/router';
import { ProfileComponent } from './pages/profile/profile.component';
import { FormElementsComponent } from './pages/forms/form-elements/form-elements.component';
import { BasicTablesComponent } from './pages/tables/basic-tables/basic-tables.component';
import { BlankComponent } from './pages/blank/blank.component';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { InvoicesComponent } from './pages/invoices/invoices.component';
import { LineChartComponent } from './pages/charts/line-chart/line-chart.component';
import { BarChartComponent } from './pages/charts/bar-chart/bar-chart.component';
import { AlertsComponent } from './pages/ui-elements/alerts/alerts.component';
import { AvatarElementComponent } from './pages/ui-elements/avatar-element/avatar-element.component';
import { BadgesComponent } from './pages/ui-elements/badges/badges.component';
import { ButtonsComponent } from './pages/ui-elements/buttons/buttons.component';
import { ImagesComponent } from './pages/ui-elements/images/images.component';
import { VideosComponent } from './pages/ui-elements/videos/videos.component';
import { SignInComponent } from './pages/auth-pages/sign-in/sign-in.component';
import { SignUpComponent } from './pages/auth-pages/sign-up/sign-up.component';
import { ForgotPasswordComponent } from './pages/auth-pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/auth-pages/reset-password/reset-password.component';
import { CalenderComponent } from './pages/calender/calender.component';

// Enterprise Modules
import { EnterpriseDashboardComponent } from './pages/dashboard/enterprise-dashboard/enterprise-dashboard.component';
import { GedListComponent } from './modules/ged/components/ged-list.component';
import { EventsListComponent } from './modules/events/components/events-list.component';
import { InvitationsComponent } from './modules/events/components/invitations.component';
import { RoomReservationsComponent } from './modules/reservations/components/room-reservations.component';
import { EquipmentReservationsComponent } from './modules/reservations/components/equipment-reservations.component';
import { NotificationsComponent } from './modules/notifications/components/notifications.component';
import { InterventionsComponent } from './modules/interventions/components/interventions.component';
import { AdminPanelComponent } from './modules/admin/components/admin-panel.component';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { AppRole } from './core/models';

const allBusinessRoles: AppRole[] = [
  'ADMIN',
  'EMPLOYEE',
  'MANAGER',
  'ROOM_MANAGER',
  'SECURITY_MANAGER',
  'DSN_DIRECTOR',
  'QUALITY_MANAGER'
];

export const routes: Routes = [
  // auth pages
  {
    path:'signin',
    component:SignInComponent,
    title:'Angular Sign In Dashboard | TailAdmin - Angular Admin Dashboard Template'
  },
  {
    path:'signup',
    component:SignUpComponent,
    title:'Angular Sign Up Dashboard | TailAdmin - Angular Admin Dashboard Template'
  },
  {
    path:'forgot-password',
    component:ForgotPasswordComponent,
    title:'Angular Forgot Password | TailAdmin - Angular Admin Dashboard Template'
  },
  {
    path:'reset-password',
    component:ResetPasswordComponent,
    title:'Angular Reset Password | TailAdmin - Angular Admin Dashboard Template'
  },
  {
    path:'',
    component:AppLayoutComponent,
    canActivate: [authGuard],
    children:[
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path:'dashboard',
        component: EnterpriseDashboardComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_REPORTS_MODULE'] },
        title: 'Enterprise Dashboard | Enterprise Management System',
      },
      {
        path:'calendar',
        component:CalenderComponent,
        title:'Angular Calender | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'profile',
        component:ProfileComponent,
        title:'Angular Profile Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'form-elements',
        component:FormElementsComponent,
        title:'Angular Form Elements Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'basic-tables',
        component:BasicTablesComponent,
        title:'Angular Basic Tables Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'blank',
        component:BlankComponent,
        title:'Angular Blank Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      // support tickets
      {
        path:'invoice',
        component:InvoicesComponent,
        title:'Angular Invoice Details Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'line-chart',
        component:LineChartComponent,
        title:'Angular Line Chart Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'bar-chart',
        component:BarChartComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_REPORTS_MODULE'] },
        title:'Angular Bar Chart Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'alerts',
        component:AlertsComponent,
        title:'Angular Alerts Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'avatars',
        component:AvatarElementComponent,
        title:'Angular Avatars Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'badge',
        component:BadgesComponent,
        title:'Angular Badges Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'buttons',
        component:ButtonsComponent,
        title:'Angular Buttons Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'images',
        component:ImagesComponent,
        title:'Angular Images Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'videos',
        component:VideosComponent,
        title:'Angular Videos Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },

      // Enterprise Modules
      // Document Management (GED)
      {
        path:'documents',
        component:GedListComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_GED_MODULE'] },
        title:'Document Management | Enterprise System',
      },

      // Events Management
      {
        path:'events',
        component:EventsListComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_EVENTS_MODULE'] },
        title:'Events Management | Enterprise System',
      },
      {
        path:'invitations',
        component:InvitationsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'EMPLOYEE', 'MANAGER', 'DSN_DIRECTOR'] as AppRole[], permissions: ['VIEW_EVENTS_MODULE'] },
        title:'Event Invitations | Enterprise System',
      },

      // Reservations
      {
        path:'reservations',
        redirectTo:'reservations/salles',
        pathMatch: 'full',
      },
      {
        path:'reservations/salles',
        component:RoomReservationsComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles },
        title:'Reservations Salles | Enterprise System',
      },
      {
        path:'reservations/equipements',
        component:EquipmentReservationsComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles },
        title:'Reservations Equipements | Enterprise System',
      },

      // Technical Interventions
      {
        path:'interventions',
        component:InterventionsComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles, permissions: ['VIEW_INTERVENTIONS_MODULE'] },
        title:'Technical Interventions | Enterprise System',
      },

      // Notifications
      {
        path:'notifications',
        component:NotificationsComponent,
        canActivate: [roleGuard],
        data: { roles: allBusinessRoles },
        title:'Notifications | Enterprise System',
      },

      // Administration
      {
        path:'admin',
        component:AdminPanelComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] as AppRole[], permissions: ['VIEW_USERS_MODULE'] },
        title:'Administration Panel | Enterprise System',
      },
    ]
  },
  // error pages
  {
    path:'**',
    component:NotFoundComponent,
    title:'Angular NotFound Dashboard | TailAdmin - Angular Admin Dashboard Template'
  },
];
