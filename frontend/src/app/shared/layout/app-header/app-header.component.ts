import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationDropdownComponent } from '../../components/header/notification-dropdown/notification-dropdown.component';
import { UserDropdownComponent } from '../../components/header/user-dropdown/user-dropdown.component';
import { SidebarService } from '../../services/sidebar.service';

type BreadcrumbItem = {
  label: string;
  route: string;
};

@Component({
  selector: 'app-header',
  imports: [CommonModule, FormsModule, RouterModule, NotificationDropdownComponent, UserDropdownComponent],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  @ViewChild('globalSearchInput')
  globalSearchInput?: ElementRef<HTMLInputElement>;

  isApplicationMenuOpen = false;
  globalSearch = '';
  breadcrumbItems: BreadcrumbItem[] = [];
  unreadNotificationsCount = 0;

  readonly isMobileOpen$;

  private readonly subscription = new Subscription();

  constructor(
    public sidebarService: SidebarService,
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  ngOnInit(): void {
    this.breadcrumbItems = this.buildBreadcrumbs(this.router.url);

    this.subscription.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe((event) => {
          const navigation = event as NavigationEnd;
          this.breadcrumbItems = this.buildBreadcrumbs(navigation.urlAfterRedirects);
        })
    );

    this.subscription.add(
      this.notificationService.getUnreadCount().subscribe({
        next: (count) => {
          this.unreadNotificationsCount = Math.max(0, Number(count) || 0);
        },
        error: () => {
          this.unreadNotificationsCount = 0;
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  handleToggle(): void {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  toggleApplicationMenu(): void {
    this.isApplicationMenuOpen = !this.isApplicationMenuOpen;
  }

  onSubmitGlobalSearch(event: Event): void {
    event.preventDefault();
    const target = this.resolveSearchTarget(this.globalSearch);
    void this.router.navigateByUrl(target);
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.focusSearchInput();
    }
  }

  private focusSearchInput(): void {
    if (!this.globalSearchInput?.nativeElement) {
      return;
    }
    this.globalSearchInput.nativeElement.focus();
    this.globalSearchInput.nativeElement.select();
  }

  private buildBreadcrumbs(url: string): BreadcrumbItem[] {
    const path = url.split('?')[0] || '';
    const segments = path.split('/').filter(Boolean);

    if (segments.length === 0) {
      return [{ label: 'Accueil', route: '/dashboard' }];
    }

    const labels: Record<string, string> = {
      dashboard: 'Tableau de bord',
      documents: 'GED',
      events: 'Evenements',
      invitations: 'Invitations',
      reservations: 'Reservations',
      salles: 'Salles',
      equipements: 'Equipements',
      interventions: 'Interventions',
      it: 'Parc IT',
      notifications: 'Notifications',
      admin: 'Administration',
      workflows: 'Workflows',
      profile: 'Profil',
      reporting: 'Reporting',
    };

    const breadcrumbs: BreadcrumbItem[] = [{ label: 'Accueil', route: '/dashboard' }];
    let cumulativeRoute = '';

    segments.forEach((segment) => {
      cumulativeRoute += `/${segment}`;
      breadcrumbs.push({
        label: labels[segment] || this.toTitleCase(segment),
        route: cumulativeRoute,
      });
    });

    return breadcrumbs;
  }

  private resolveSearchTarget(query: string): string {
    const term = query.trim().toLowerCase();
    if (!term) {
      return '/dashboard';
    }

    if (term.includes('ged') || term.includes('document')) {
      return '/documents';
    }
    if (term.includes('evenement') || term.includes('calendrier')) {
      return '/events';
    }
    if (term.includes('invitation')) {
      return '/invitations';
    }
    if (term.includes('salle') || term.includes('reservation')) {
      return '/reservations/salles';
    }
    if (term.includes('equipement')) {
      if (this.authService.canAccess(['ADMIN', 'IT_MANAGER'])) {
        return '/it/equipements';
      }
      return '/reservations/equipements';
    }
    if (term.includes('intervention')) {
      if (this.authService.canAccess(['ADMIN', 'ROOM_MANAGER'])) {
        return '/interventions';
      }
      return '/it/interventions';
    }
    if (term.includes('notification') || term.includes('message') || term.includes('email')) {
      return '/notifications';
    }
    if (term.includes('workflow')) {
      if (this.authService.canAccess(['ADMIN']) && this.authService.hasAllPermissions(['VIEW_USERS_MODULE'])) {
        return '/admin/workflows';
      }
      return '/dashboard';
    }
    if (term.includes('admin') || term.includes('utilisateur') || term.includes('permission')) {
      if (this.authService.canAccess(['ADMIN']) && this.authService.hasAllPermissions(['VIEW_USERS_MODULE'])) {
        return '/admin';
      }
      return '/dashboard';
    }
    if (term.includes('report') || term.includes('kpi') || term.includes('stat')) {
      return '/reporting';
    }

    return '/dashboard';
  }

  private toTitleCase(value: string): string {
    if (!value) {
      return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
