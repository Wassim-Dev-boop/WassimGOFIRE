import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { catchError, combineLatest, map, of, Subscription } from 'rxjs';
import { DocumentService, GedAuditLogEntry } from '../../../core/services/document.service';
import { EventService } from '../../../core/services/event.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { InterventionService } from '../../../core/services/intervention.service';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ItEquipmentService } from '../../../core/services/it-equipment.service';
import { ItInterventionService } from '../../../core/services/it-intervention.service';
import {
  AppRole,
  Document as GedDocument,
  EquipmentReservation,
  Event as EnterpriseEvent,
  Invitation,
  InvitationStatus,
  Intervention,
  InterventionStatus,
  Notification as AppNotification,
  Equipment,
  Room,
  RoomReservation,
  UserStatistics,
  ItEquipment,
  ItIntervention,
} from '../../../core/models';
import { SafeHtmlPipe } from '../../../shared/pipe/safe-html.pipe';
import { ActivityChartComponent } from '../../../shared/components/dashboard/activity-chart/activity-chart.component';
import { MonthlyPerformanceComponent } from '../../../shared/components/dashboard/monthly-performance/monthly-performance.component';

type DeltaTone = 'positive' | 'negative';

interface DashboardKpiCard {
  label: string;
  value: number;
  delta: string;
  deltaTone: DeltaTone;
  icon: string;
  iconColorClass: string;
}

interface ReservationMonthPoint {
  month: string;
  rooms: number;
  equipment: number;
}

interface StatusSegment {
  label: string;
  percentage: number;
  color: string;
}

interface ActivityItem {
  title: string;
  timestamp: Date;
  timeAgo: string;
  tag: string;
  tagClass: string;
  dotClass: string;
}

interface QuickAction {
  label: string;
  route: string;
  icon: string;
  queryParams?: Record<string, string>;
}

interface DashboardTaskItem {
  title: string;
  detail: string;
  tone: 'high' | 'medium' | 'low';
  route?: string;
  queryParams?: Record<string, string>;
}

interface UpcomingEventItem {
  id: string;
  title: string;
  dateLabel: string;
  locationLabel: string;
  statusLabel: string;
  statusClass: string;
  route: string;
}

interface MiniCalendarCell {
  date: Date | null;
  dayNumber: number | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  eventCount: number;
}

const MANAGER_RESPONSIBLE_ROLES: AppRole[] = [
  'MANAGER',
  'ROOM_MANAGER',
  'IT_MANAGER',
  'SECURITY_MANAGER',
  'DSN_DIRECTOR',
  'QUALITY_MANAGER',
];

const USERS_ICON = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 19C16 16.7909 14.2091 15 12 15H8C5.79086 15 4 16.7909 4 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><circle cx="10" cy="8" r="3" stroke="currentColor" stroke-width="1.7"></circle><path d="M20 8V14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><path d="M23 11H17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>`;
const RESERVATION_ICON = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.7"></rect><path d="M8 3V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><path d="M16 3V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><path d="M3.5 10H20.5" stroke="currentColor" stroke-width="1.7"></path></svg>`;
const INVITATION_ICON = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"></rect><path d="M3.5 7L12 13L20.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const INTERVENTION_ICON = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 6.5L17.5 3.5L20.5 6.5L17.5 9.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 20L10.2 13.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><path d="M7.2 12.8L10.6 16.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><path d="M14.5 6.5L7.2 13.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>`;
const DOCUMENT_ICON = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 3.5H14L18.5 8V20.5H7C5.89543 20.5 5 19.6046 5 18.5V5.5C5 4.39543 5.89543 3.5 7 3.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M14 3.5V8H18.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path></svg>`;
const NOTIFICATION_ICON = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 17H18L16.8 15.8C16.2861 15.2861 16 14.5891 16 13.8627V11C16 8.79086 14.2091 7 12 7C9.79086 7 8 8.79086 8 11V13.8627C8 14.5891 7.71392 15.2861 7.2 15.8L6 17Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><path d="M10 18.5C10 19.6046 10.8954 20.5 12 20.5C13.1046 20.5 14 19.6046 14 18.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>`;
const USER_ACTION_ICON = `<svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 16C14 13.7909 12.2091 12 10 12H6C3.79086 12 2 13.7909 2 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.6"></circle><path d="M15 5V11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M18 8H12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>`;
const RESERVATION_ACTION_ICON = `<svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="4" width="15" height="13" rx="2" stroke="currentColor" stroke-width="1.6"></rect><path d="M6 2.5V5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M14 2.5V5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M2.5 8H17.5" stroke="currentColor" stroke-width="1.6"></path></svg>`;
const TOOL_ACTION_ICON = `<svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 5.5L15.5 2.5L17.5 4.5L14.5 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path><path d="M3 17L8.2 11.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M5.8 10.8L8.8 13.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M12.5 5.5L5.8 12.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>`;
const REPORT_ACTION_ICON = `<svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 16.5H15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M6.5 14.5V8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M10 14.5V5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M13.5 14.5V10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>`;
const EVENT_ACTION_ICON = `<svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="4" width="15" height="13" rx="2" stroke="currentColor" stroke-width="1.6"></rect><path d="M6 2.5V5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M14 2.5V5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M2.5 8H17.5" stroke="currentColor" stroke-width="1.6"></path></svg>`;

@Component({
  selector: 'app-enterprise-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SafeHtmlPipe,
    ActivityChartComponent,
    MonthlyPerformanceComponent,
  ],
  templateUrl: './enterprise-dashboard.component.html',
  styleUrls: ['./enterprise-dashboard.component.css']
})
export class EnterpriseDashboardComponent implements OnInit, OnDestroy {
  isAdminView = false;
  isEmployeeView = false;
  isManagerResponsibleView = false;
  isLoading = true;
  hasError = false;
  loadErrorMessage = '';
  currentRole: AppRole = 'EMPLOYEE';
  dashboardTitle = 'Tableau de bord';
  dashboardMotionReady = false;
  chartsAnimated = false;

  kpiCards: DashboardKpiCard[] = [];
  animatedKpiValues: number[] = [];
  reservationSeries: ReservationMonthPoint[] = [];
  statusSegments: StatusSegment[] = [];
  animatedStatusSegments: StatusSegment[] = [];
  statusChartGradient =
    'conic-gradient(#ef4444 0% 18%, #f59e0b 18% 45%, #3b82f6 45% 80%, #65a30d 80% 100%)';
  animatedStatusChartGradient = this.statusChartGradient;
  recentActivities: ActivityItem[] = [];
  maxReservationValue = 1;

  monthlyActivityTitle = "Flux d'activite mensuel";
  monthlyActivitySeriesName = 'Operations';
  monthlyActivityCategories: string[] | null = null;
  monthlyActivityData: number[] | null = null;

  monthlyTargetTitle = 'Objectif mensuel';
  monthlyTargetSubtitle = 'Suivi reel des demandes traitees';
  monthlyTargetProgress = 0;
  monthlyTargetDeltaPercent = 0;
  monthlyTargetSummaryText =
    'Aucune activite enregistree pour le moment.';
  monthlyTargetValue = 0;
  monthlyTargetRevenueValue = 0;
  monthlyTargetTodayValue = 0;
  monthlyTargetLabel = 'Objectif';
  monthlyRevenueLabel = 'Traite';
  monthlyTodayLabel = "Auj.";
  monthlyTargetValueFormat: 'currency' | 'number' = 'number';
  monthlyTargetTrend: 'up' | 'down' = 'down';
  monthlyRevenueTrend: 'up' | 'down' = 'up';
  monthlyTodayTrend: 'up' | 'down' = 'up';

  quickActions: QuickAction[] = [];
  roleTasks: DashboardTaskItem[] = [];
  upcomingEvents: UpcomingEventItem[] = [];
  miniCalendarCells: MiniCalendarCell[] = [];
  miniCalendarMonthLabel = '';
  canViewEventsForRole = false;
  canViewItForRole = false;

  private readonly adminQuickActions: QuickAction[] = [
    {
      label: 'Gerer les utilisateurs',
      route: '/admin',
      icon: USER_ACTION_ICON,
    },
    {
      label: 'Voir toutes les reservations',
      route: '/reservations/salles',
      icon: RESERVATION_ACTION_ICON,
    },
    {
      label: 'Interventions en attente',
      route: '/interventions',
      icon: TOOL_ACTION_ICON,
    },
    {
      label: 'Consulter les notifications',
      route: '/notifications',
      icon: NOTIFICATION_ICON,
    },
  ];

  private readonly employeeQuickActions: QuickAction[] = [
    {
      label: 'Reserver une salle',
      route: '/reservations/salles',
      icon: RESERVATION_ACTION_ICON,
    },
    {
      label: 'Reserver un equipement',
      route: '/reservations/equipements',
      icon: RESERVATION_ACTION_ICON,
    },
    {
      label: 'Declarer une intervention',
      route: '/it/interventions',
      icon: TOOL_ACTION_ICON,
    },
    {
      label: 'Parcourir la GED',
      route: '/documents',
      icon: DOCUMENT_ICON,
    },
  ];

  private readonly managerResponsibleQuickActions: QuickAction[] = [
    {
      label: 'Reserver une salle',
      route: '/reservations/salles',
      icon: RESERVATION_ACTION_ICON,
    },
    {
      label: 'Voir mon equipe',
      route: '/profile',
      icon: USER_ACTION_ICON,
    },
    {
      label: 'Creer un evenement',
      route: '/events',
      icon: EVENT_ACTION_ICON,
    },
    {
      label: 'Envoyer invitations',
      route: '/invitations',
      icon: INVITATION_ICON,
    },
  ];

  private readonly subscription = new Subscription();
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private dashboardRevealTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private kpiAnimationFrameId: number | null = null;
  private chartAnimationFrameId: number | null = null;
  private chartAnimationTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private documentService: DocumentService,
    private eventService: EventService,
    private reservationService: ReservationService,
    private interventionService: InterventionService,
    private adminService: AdminService,
    private authService: AuthService,
    private invitationService: InvitationService,
    private notificationService: NotificationService,
    private itEquipmentService: ItEquipmentService,
    private itInterventionService: ItInterventionService
  ) {}

  ngOnInit(): void {
    this.currentRole = this.authService.currentRole;
    this.dashboardTitle = this.getDashboardTitle(this.currentRole);

    const canViewReports = this.authService.hasPermission('VIEW_REPORTS_MODULE');
    this.isAdminView = canViewReports && this.currentRole === 'ADMIN';
    this.isEmployeeView = canViewReports && this.currentRole === 'EMPLOYEE';
    this.isManagerResponsibleView = canViewReports && MANAGER_RESPONSIBLE_ROLES.includes(
      this.currentRole
    );
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.stopDashboardAnimations();
    this.subscription.unsubscribe();
  }

  reloadDashboard(): void {
    this.isLoading = true;
    this.hasError = false;
    this.loadErrorMessage = '';
    this.stopDashboardAnimations();
    this.loadDashboardData();
  }

  getBarHeight(value: number): number {
    if (this.maxReservationValue <= 0 || value <= 0) {
      return 0;
    }

    return (value / this.maxReservationValue) * 100;
  }

  getAnimatedBarHeight(value: number): number {
    if (!this.chartsAnimated) {
      return 0;
    }

    return this.getBarHeight(value);
  }

  getAnimatedKpiValue(index: number, fallback: number): number {
    return this.animatedKpiValues.length > index
      ? this.animatedKpiValues[index]
      : fallback;
  }

  get currentRoleLabel(): string {
    return this.authService.roleLabels[this.currentRole] ?? this.currentRole;
  }

  get quickActionsWithState(): Array<QuickAction & { disabled: boolean; disabledReason: string }> {
    return this.quickActions.map((action) => {
      const disabledReason = this.getQuickActionDisabledReason(action.route);
      return {
        ...action,
        disabled: !!disabledReason,
        disabledReason: disabledReason ?? '',
      };
    });
  }

  getTaskToneClass(task: DashboardTaskItem): string {
    if (task.tone === 'high') {
      return 'bg-error-50 text-error-700';
    }
    if (task.tone === 'medium') {
      return 'bg-warning-50 text-warning-700';
    }
    return 'bg-success-50 text-success-700';
  }

  getUpcomingEmptyMessage(): string {
    if (!this.canViewEventsForRole) {
      return "Votre role n'a pas acces au module Evenements.";
    }

    return 'Aucun evenement a venir.';
  }

  private getDashboardTitle(role: AppRole): string {
    if (role === 'ADMIN') {
      return 'Tableau de bord administrateur';
    }
    if (role === 'EMPLOYEE') {
      return 'Tableau de bord employé';
    }
    if (role === 'MANAGER') {
      return 'Tableau de bord chef hiérarchique';
    }
    if (role === 'SECURITY_MANAGER') {
      return 'Tableau de bord responsable sécurité';
    }
    if (role === 'ROOM_MANAGER') {
      return 'Tableau de bord responsable salle';
    }
    if (role === 'IT_MANAGER') {
      return 'Tableau de bord responsable IT';
    }
    if (role === 'QUALITY_MANAGER') {
      return 'Tableau de bord responsable qualité';
    }
    if (role === 'DSN_DIRECTOR') {
      return 'Tableau de bord directeur DSN';
    }
    return 'Tableau de bord';
  }

  private configureDashboardCharts(
    documents: GedDocument[],
    events: EnterpriseEvent[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[]
  ): void {
    const { categories, series } = this.buildMonthlyActivityPayload(
      documents,
      events,
      roomReservations,
      equipmentReservations,
      interventions,
      invitations
    );

    this.monthlyActivityCategories = categories;
    this.monthlyActivityData = series;

    const currentMonth = new Date();
    const previousMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );

    const incomingThisMonth = this.countIncomingOperationsForMonth(
      currentMonth,
      documents,
      events,
      roomReservations,
      equipmentReservations,
      interventions,
      invitations
    );
    const processedThisMonth = this.countProcessedOperationsForMonth(
      currentMonth,
      documents,
      roomReservations,
      equipmentReservations,
      interventions,
      invitations
    );
    const processedPreviousMonth = this.countProcessedOperationsForMonth(
      previousMonth,
      documents,
      roomReservations,
      equipmentReservations,
      interventions,
      invitations
    );

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const processedToday = this.countProcessedOperationsForDay(
      today,
      documents,
      roomReservations,
      equipmentReservations,
      interventions,
      invitations
    );
    const processedYesterday = this.countProcessedOperationsForDay(
      yesterday,
      documents,
      roomReservations,
      equipmentReservations,
      interventions,
      invitations
    );

    this.monthlyTargetValue = incomingThisMonth;
    this.monthlyTargetRevenueValue = processedThisMonth;
    this.monthlyTargetTodayValue = processedToday;
    this.monthlyTargetProgress =
      incomingThisMonth > 0
        ? (processedThisMonth / incomingThisMonth) * 100
        : 0;

    const monthlyDelta =
      processedPreviousMonth > 0
        ? ((processedThisMonth - processedPreviousMonth) / processedPreviousMonth) *
          100
        : processedThisMonth > 0
          ? 100
          : 0;

    this.monthlyTargetDeltaPercent = Number(monthlyDelta.toFixed(1));
    this.monthlyTargetTrend =
      incomingThisMonth > 0 && processedThisMonth >= incomingThisMonth
        ? 'up'
        : 'down';
    this.monthlyRevenueTrend = monthlyDelta >= 0 ? 'up' : 'down';

    const todayDelta =
      processedYesterday > 0
        ? ((processedToday - processedYesterday) / processedYesterday) * 100
        : processedToday > 0
          ? 100
          : 0;
    this.monthlyTodayTrend = todayDelta >= 0 ? 'up' : 'down';

    if (incomingThisMonth === 0 && processedThisMonth === 0) {
      this.monthlyTargetSummaryText =
        'Aucune demande ce mois. Les indicateurs se mettront a jour automatiquement.';
      return;
    }

    const direction = this.monthlyTargetDeltaPercent >= 0 ? 'hausse' : 'baisse';
    const volumeLabel =
      processedToday > 1 ? 'demandes traitees' : 'demande traitee';
    this.monthlyTargetSummaryText = `${processedToday} ${volumeLabel} aujourd'hui. ${Math.abs(
      this.monthlyTargetDeltaPercent
    ).toFixed(1)}% de ${direction} vs mois precedent.`;
  }

  private buildMonthlyActivityPayload(
    documents: GedDocument[],
    events: EnterpriseEvent[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[]
  ): {
    categories: string[];
    series: number[];
  } {
    const monthLabels = [
      'Jan',
      'Fev',
      'Mar',
      'Avr',
      'Mai',
      'Juin',
      'Juil',
      'Aou',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const now = new Date();
    const categories: string[] = [];
    const keys: string[] = [];
    const series: number[] = [];

    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      categories.push(monthLabels[date.getMonth()]);
      keys.push(`${date.getFullYear()}-${date.getMonth()}`);
      series.push(0);
    }

    const monthIndex = new Map(
      keys.map((key, index) => [key, index] as const)
    );

    const incrementMonth = (date: Date): void => {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const index = monthIndex.get(key);
      if (index === undefined) {
        return;
      }

      series[index] += 1;
    };

    documents.forEach((document) => incrementMonth(document.uploadedAt));
    events.forEach((event) => incrementMonth(event.createdAt));
    roomReservations.forEach((reservation) => incrementMonth(reservation.createdAt));
    equipmentReservations.forEach((reservation) =>
      incrementMonth(reservation.createdAt)
    );
    interventions.forEach((intervention) =>
      incrementMonth(intervention.createdAt)
    );
    invitations.forEach((invitation) => incrementMonth(invitation.sentAt));

    return {
      categories,
      series,
    };
  }

  private countIncomingOperationsForMonth(
    referenceMonth: Date,
    documents: GedDocument[],
    events: EnterpriseEvent[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[]
  ): number {
    const documentIncoming = documents.filter((document) =>
      this.isInMonth(document.uploadedAt, referenceMonth)
    ).length;
    const eventIncoming = events.filter((event) =>
      this.isInMonth(event.createdAt, referenceMonth)
    ).length;
    const roomIncoming = roomReservations.filter((reservation) =>
      this.isInMonth(reservation.createdAt, referenceMonth)
    ).length;
    const equipmentIncoming = equipmentReservations.filter((reservation) =>
      this.isInMonth(reservation.createdAt, referenceMonth)
    ).length;
    const interventionIncoming = interventions.filter((intervention) =>
      this.isInMonth(intervention.createdAt, referenceMonth)
    ).length;
    const invitationIncoming = invitations.filter((invitation) =>
      this.isInMonth(invitation.sentAt, referenceMonth)
    ).length;

    return (
      documentIncoming +
      eventIncoming +
      roomIncoming +
      equipmentIncoming +
      interventionIncoming +
      invitationIncoming
    );
  }

  private countProcessedOperationsForMonth(
    referenceMonth: Date,
    documents: GedDocument[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[]
  ): number {
    const roomProcessed = roomReservations.filter(
      (reservation) =>
        reservation.status !== 'PENDING' &&
        this.isInMonth(reservation.updatedAt, referenceMonth)
    ).length;

    const equipmentProcessed = equipmentReservations.filter(
      (reservation) =>
        reservation.status !== 'PENDING' &&
        this.isInMonth(reservation.updatedAt, referenceMonth)
    ).length;

    const interventionProcessed = interventions.filter(
      (intervention) =>
        [InterventionStatus.RESOLVED, InterventionStatus.CLOSED].includes(
          intervention.status
        ) && this.isInMonth(intervention.updatedAt, referenceMonth)
    ).length;

    const documentProcessed = documents.filter(
      (document) =>
        this.isDocumentProcessed(document) &&
        this.isInMonth(document.updatedAt, referenceMonth)
    ).length;

    const invitationProcessed = invitations.filter(
      (invitation) =>
        invitation.status !== InvitationStatus.PENDING &&
        invitation.respondedAt !== undefined &&
        this.isInMonth(invitation.respondedAt, referenceMonth)
    ).length;

    return (
      roomProcessed +
      equipmentProcessed +
      interventionProcessed +
      documentProcessed +
      invitationProcessed
    );
  }

  private countProcessedOperationsForDay(
    day: Date,
    documents: GedDocument[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[]
  ): number {
    const roomProcessed = roomReservations.filter(
      (reservation) =>
        reservation.status !== 'PENDING' &&
        this.isSameDay(reservation.updatedAt, day)
    ).length;

    const equipmentProcessed = equipmentReservations.filter(
      (reservation) =>
        reservation.status !== 'PENDING' &&
        this.isSameDay(reservation.updatedAt, day)
    ).length;

    const interventionProcessed = interventions.filter(
      (intervention) =>
        [InterventionStatus.RESOLVED, InterventionStatus.CLOSED].includes(
          intervention.status
        ) && this.isSameDay(intervention.updatedAt, day)
    ).length;

    const documentProcessed = documents.filter(
      (document) =>
        this.isDocumentProcessed(document) &&
        this.isSameDay(document.updatedAt, day)
    ).length;

    const invitationProcessed = invitations.filter(
      (invitation) =>
        invitation.status !== InvitationStatus.PENDING &&
        invitation.respondedAt !== undefined &&
        this.isSameDay(invitation.respondedAt, day)
    ).length;

    return (
      roomProcessed +
      equipmentProcessed +
      interventionProcessed +
      documentProcessed +
      invitationProcessed
    );
  }

  private isDocumentProcessed(document: GedDocument): boolean {
    if (document.isArchived) {
      return true;
    }

    return [
      'Publie',
      'Valide qualite',
      'Valide qualite (publiable)',
      'Archive',
      'Obsolete',
    ].includes(document.gedStatus ?? '');
  }

  private isInMonth(date: Date, referenceMonth: Date): boolean {
    return (
      date.getFullYear() === referenceMonth.getFullYear() &&
      date.getMonth() === referenceMonth.getMonth()
    );
  }

  private loadDashboardData(): void {
    const canViewGed = this.hasEffectivePermission('VIEW_GED_MODULE');
    const canViewEvents = this.hasEffectivePermission('VIEW_EVENTS_MODULE');
    const canViewInterventions = this.hasEffectivePermission('VIEW_INTERVENTIONS_MODULE');
    const canViewItOperations =
      this.currentRole === 'ADMIN' ||
      this.currentRole === 'IT_MANAGER';
    const canViewReservations = ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'SECURITY_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER']
      .includes(this.currentRole);
    const canViewOperationalInterventions = canViewInterventions
      && ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER'].includes(this.currentRole);
    const canViewNotifications = [
      'ADMIN',
      'EMPLOYEE',
      'MANAGER',
      'ROOM_MANAGER',
      'SECURITY_MANAGER',
      'DSN_DIRECTOR',
      'QUALITY_MANAGER',
      'IT_MANAGER',
    ].includes(this.currentRole);
    const canViewGedAudits = this.currentRole === 'ADMIN' || this.currentRole === 'QUALITY_MANAGER';
    this.canViewEventsForRole = canViewEvents;
    this.canViewItForRole = canViewItOperations;
    this.hasError = false;
    this.loadErrorMessage = '';

    const defaultUserStats: UserStatistics = {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      usersByRole: [],
      newUsersThisMonth: 0,
      userActivityChart: [],
    };

    const userStats$ = (this.isAdminView
      ? this.adminService.getUserStatistics()
      : of(defaultUserStats)
    ).pipe(
      catchError(() => of(defaultUserStats)),
    );

    const documents$ = (canViewGed
      ? this.documentService.getDocuments()
      : of([] as GedDocument[])
    ).pipe(
      catchError(() => of([] as GedDocument[])),
    );

    const events$ = (canViewEvents
      ? this.eventService.getEvents()
      : of([] as EnterpriseEvent[])
    ).pipe(
      catchError(() => of([] as EnterpriseEvent[])),
    );

    const interventions$ = (canViewOperationalInterventions
      ? this.interventionService.getInterventions()
      : of([] as Intervention[])
    ).pipe(
      catchError(() => of([] as Intervention[])),
    );

    const invitations$ = (canViewEvents
      ? this.invitationService.getInvitations()
      : of([] as Invitation[])
    ).pipe(
      catchError(() => of([] as Invitation[])),
    );

    const roomReservations$ = (canViewReservations
      ? this.reservationService.getRoomReservations()
      : of([] as RoomReservation[])
    ).pipe(
      catchError(() => of([] as RoomReservation[])),
    );

    const equipmentReservations$ = (canViewReservations
      ? this.reservationService.getEquipmentReservations()
      : of([] as EquipmentReservation[])
    ).pipe(
      catchError(() => of([] as EquipmentReservation[])),
    );

    const notifications$ = (canViewNotifications
      ? this.notificationService.getNotifications({
        page: 0,
        size: 500,
        sort: 'createdAt,desc',
      })
      : of([] as AppNotification[])
    ).pipe(
      catchError(() => of([] as AppNotification[])),
    );

    const rooms$ = (canViewReservations
      ? this.reservationService.getRooms({
        page: 0,
        size: 200,
        sort: 'name,asc',
      })
      : of([] as Room[])
    ).pipe(
      catchError(() => of([] as Room[])),
    );

    const equipment$ = (canViewReservations
      ? this.reservationService.getEquipment({
        page: 0,
        size: 200,
        sort: 'name,asc',
      })
      : of([] as Equipment[])
    ).pipe(
      catchError(() => of([] as Equipment[])),
    );

    const auditLogs$ = (canViewGed && canViewGedAudits
      ? this.documentService.listAuditLogs({ page: 0, size: 200 }).pipe(
        map((response) => response.content ?? []),
      )
      : of([] as GedAuditLogEntry[])
    ).pipe(
      catchError(() => of([] as GedAuditLogEntry[])),
    );

    const itEquipments$ = (canViewItOperations
      ? this.itEquipmentService.listEquipments({ page: 0, size: 200 }).pipe(
        map((response) => response.content ?? []),
      )
      : of([] as ItEquipment[])
    ).pipe(
      catchError(() => of([] as ItEquipment[])),
    );

    const itInterventions$ = (canViewItOperations
      ? this.itInterventionService.listAll(0, 200).pipe(
        map((response) => response.content ?? []),
      )
      : of([] as ItIntervention[])
    ).pipe(
      catchError(() => of([] as ItIntervention[])),
    );

    this.subscription.add(
      combineLatest([
        documents$,
        events$,
        roomReservations$,
        equipmentReservations$,
        interventions$,
        userStats$,
        invitations$,
        notifications$,
        rooms$,
        equipment$,
        auditLogs$,
        itEquipments$,
        itInterventions$,
      ]).subscribe({
        next: ([
          documents,
          events,
          roomReservations,
          equipmentReservations,
          interventions,
          userStats,
          invitations,
          notifications,
          rooms,
          equipment,
          auditLogs,
          itEquipments,
          itInterventions,
        ]) => {
          const safeDocuments = Array.isArray(documents) ? documents : [];
          const safeEvents = Array.isArray(events) ? events : [];
          const safeRoomReservations = Array.isArray(roomReservations) ? roomReservations : [];
          const safeEquipmentReservations = Array.isArray(equipmentReservations) ? equipmentReservations : [];
          const safeInterventions = Array.isArray(interventions) ? interventions : [];
          const safeInvitations = Array.isArray(invitations) ? invitations : [];
          const safeNotifications = Array.isArray(notifications) ? notifications : [];
          const safeRooms = Array.isArray(rooms) ? rooms : [];
          const safeEquipment = Array.isArray(equipment) ? equipment : [];
          const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
          const safeItEquipments = Array.isArray(itEquipments) ? itEquipments : [];
          const safeItInterventions = Array.isArray(itInterventions) ? itInterventions : [];
          const safeUserStats: UserStatistics = userStats ?? defaultUserStats;

          this.reservationSeries = this.buildReservationSeries(
            safeRoomReservations,
            safeEquipmentReservations
          );
          this.maxReservationValue = this.reservationSeries.length > 0
            ? Math.max(
              ...this.reservationSeries.map((point) =>
                Math.max(point.rooms, point.equipment)
              )
            )
            : 0;

          this.configureDashboardCharts(
            safeDocuments,
            safeEvents,
            safeRoomReservations,
            safeEquipmentReservations,
            safeInterventions,
            safeInvitations
          );

          this.statusSegments = this.buildStatusSegments(safeInterventions);
          this.statusChartGradient = this.buildStatusGradient(this.statusSegments);

          if (this.isAdminView) {
            this.kpiCards = this.buildAdminKpis(
              safeDocuments,
              safeRoomReservations,
              safeEquipmentReservations,
              safeInterventions,
              safeUserStats
            );
            this.recentActivities = this.buildAdminRecentActivities(
              safeDocuments,
              safeEvents,
              safeRoomReservations,
              safeEquipmentReservations,
              safeInterventions
            );
            this.quickActions = [...this.adminQuickActions];
          } else if (this.isEmployeeView) {
            this.kpiCards = this.buildEmployeeKpis(
              safeEvents,
              safeRoomReservations,
              safeEquipmentReservations,
              safeInterventions,
              safeInvitations,
              safeNotifications
            );
            this.recentActivities = this.buildEmployeeRecentActivities(
              safeDocuments,
              safeInvitations,
              safeRoomReservations,
              safeEquipmentReservations,
              safeInterventions
            );
            this.quickActions = [...this.employeeQuickActions];
          } else if (this.isManagerResponsibleView) {
            this.kpiCards = this.buildRoleSpecificKpis(
              this.currentRole,
              safeEvents,
              safeInvitations,
              safeDocuments,
              safeRoomReservations,
              safeEquipmentReservations,
              safeInterventions,
              safeRooms,
              safeEquipment,
              safeAuditLogs,
              safeUserStats,
              safeItEquipments,
              safeItInterventions,
            );
            this.recentActivities = this.buildRoleSpecificRecentActivities(
              this.currentRole,
              safeDocuments,
              safeInvitations,
              safeRoomReservations,
              safeEvents,
              safeInterventions,
              safeItInterventions,
              safeItEquipments,
            );
            this.quickActions = this.getRoleQuickActions(this.currentRole);
          } else {
            this.kpiCards = [];
            this.quickActions = [];
            this.recentActivities = [];
          }

          this.upcomingEvents = this.buildUpcomingEvents(safeEvents);
          this.miniCalendarMonthLabel = this.formatMiniCalendarMonth(new Date());
          this.miniCalendarCells = this.buildMiniCalendarCells(
            new Date(),
            this.extractEventDates(safeEvents)
          );
          this.roleTasks = this.buildRoleTasks(
            this.currentRole,
            safeEvents,
            safeInvitations,
            safeRoomReservations,
            safeEquipmentReservations,
            safeInterventions,
            safeDocuments,
            safeItInterventions,
            safeNotifications,
          );

          this.isLoading = false;
          this.startDashboardAnimations();
        },
        error: () => {
          this.stopDashboardAnimations();
          this.hasError = true;
          this.loadErrorMessage = 'Impossible de charger le tableau de bord pour le moment.';
          this.isLoading = false;
        },
      })
    );
  }

  private hasEffectivePermission(permissionCode: string): boolean {
    const currentUserPermissions = this.authService.currentUser?.permissions ?? [];
    if (currentUserPermissions.length > 0) {
      return currentUserPermissions.includes(permissionCode);
    }

    return this.authService.hasPermission(permissionCode);
  }

  private startDashboardAnimations(): void {
    this.stopDashboardAnimations();

    if (this.prefersReducedMotion) {
      this.dashboardMotionReady = true;
      this.chartsAnimated = true;
      this.animatedKpiValues = this.kpiCards.map((card) => card.value);
      this.animatedStatusSegments = this.statusSegments.map((segment) => ({
        ...segment,
      }));
      this.animatedStatusChartGradient = this.statusChartGradient;
      return;
    }

    this.dashboardMotionReady = false;
    this.startKpiCountAnimation();
    this.startChartsAnimation();

    this.dashboardRevealTimeoutId = setTimeout(() => {
      this.dashboardMotionReady = true;
    }, 20);
  }

  private startKpiCountAnimation(): void {
    this.stopKpiAnimation();
    this.animatedKpiValues = this.kpiCards.map(() => 0);

    const durationMs = 950;
    const animationStart = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - animationStart) / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 4);

      this.animatedKpiValues = this.kpiCards.map((card) =>
        Math.round(card.value * easedProgress)
      );

      if (progress < 1) {
        this.kpiAnimationFrameId = requestAnimationFrame(step);
        return;
      }

      this.kpiAnimationFrameId = null;
      this.animatedKpiValues = this.kpiCards.map((card) => card.value);
    };

    this.kpiAnimationFrameId = requestAnimationFrame(step);
  }

  private startChartsAnimation(): void {
    this.stopChartAnimation();
    this.chartsAnimated = false;

    const zeroSegments = this.statusSegments.map((segment) => ({
      ...segment,
      percentage: 0,
    }));

    this.animatedStatusSegments = zeroSegments;
    this.animatedStatusChartGradient = this.buildStatusGradient(zeroSegments);

    this.chartAnimationTimeoutId = setTimeout(() => {
      this.chartsAnimated = true;

      const durationMs = 1200;
      const animationStart = performance.now();

      const step = (now: number) => {
        const progress = Math.min((now - animationStart) / durationMs, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        const interpolatedSegments = this.statusSegments.map((segment) => ({
          ...segment,
          percentage: segment.percentage * easedProgress,
        }));

        this.animatedStatusChartGradient = this.buildStatusGradient(
          interpolatedSegments
        );

        this.animatedStatusSegments = this.statusSegments.map((segment) => ({
          ...segment,
          percentage: Math.round(segment.percentage * easedProgress),
        }));

        if (progress < 1) {
          this.chartAnimationFrameId = requestAnimationFrame(step);
          return;
        }

        this.chartAnimationFrameId = null;
        this.animatedStatusSegments = this.statusSegments.map((segment) => ({
          ...segment,
        }));
        this.animatedStatusChartGradient = this.statusChartGradient;
      };

      this.chartAnimationFrameId = requestAnimationFrame(step);
    }, 60);
  }

  private stopChartAnimation(): void {
    if (this.chartAnimationTimeoutId !== null) {
      clearTimeout(this.chartAnimationTimeoutId);
      this.chartAnimationTimeoutId = null;
    }

    if (this.chartAnimationFrameId !== null) {
      cancelAnimationFrame(this.chartAnimationFrameId);
      this.chartAnimationFrameId = null;
    }
  }

  private stopKpiAnimation(): void {
    if (this.kpiAnimationFrameId !== null) {
      cancelAnimationFrame(this.kpiAnimationFrameId);
      this.kpiAnimationFrameId = null;
    }
  }

  private stopDashboardAnimations(): void {
    if (this.dashboardRevealTimeoutId !== null) {
      clearTimeout(this.dashboardRevealTimeoutId);
      this.dashboardRevealTimeoutId = null;
    }

    this.stopKpiAnimation();
    this.stopChartAnimation();
  }

  private buildAdminKpis(
    documents: GedDocument[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    userStats: UserStatistics
  ): DashboardKpiCard[] {
    const activeReservations =
      roomReservations.filter((reservation) => reservation.status === 'APPROVED')
        .length +
      equipmentReservations.filter(
        (reservation) =>
          reservation.status === 'APPROVED' || reservation.status === 'IN_USE'
      ).length;

    const openInterventions = interventions.filter((intervention) =>
      [
        InterventionStatus.OPEN,
        InterventionStatus.ASSIGNED,
        InterventionStatus.IN_PROGRESS,
      ].includes(intervention.status)
    ).length;

    const documentsThisMonth = this.countInCurrentMonth(
      documents.map((document) => document.updatedAt)
    );
    const reservationsToday =
      roomReservations.filter((reservation) =>
        this.isSameDay(reservation.createdAt, new Date())
      ).length +
      equipmentReservations.filter((reservation) =>
        this.isSameDay(reservation.createdAt, new Date())
      ).length;

    const todayOpen = interventions.filter(
      (intervention) =>
        [
          InterventionStatus.OPEN,
          InterventionStatus.ASSIGNED,
          InterventionStatus.IN_PROGRESS,
        ].includes(intervention.status) &&
        this.isSameDay(intervention.createdAt, new Date())
    ).length;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayOpen = interventions.filter(
      (intervention) =>
        [
          InterventionStatus.OPEN,
          InterventionStatus.ASSIGNED,
          InterventionStatus.IN_PROGRESS,
        ].includes(intervention.status) &&
        this.isSameDay(intervention.createdAt, yesterday)
    ).length;

    const interventionDiff = todayOpen - yesterdayOpen;

    return [
      {
        label: 'Utilisateurs',
        value: userStats.activeUsers,
        delta: `${this.formatSigned(userStats.newUsersThisMonth)} ce mois`,
        deltaTone: 'positive',
        icon: USERS_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Reservations actives',
        value: activeReservations,
        delta: `${this.formatSigned(reservationsToday)} aujourd'hui`,
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Interventions ouvertes',
        value: openInterventions,
        delta: `${this.formatSigned(interventionDiff)} vs hier`,
        deltaTone: interventionDiff > 0 ? 'positive' : 'negative',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Documents GED',
        value: documents.length,
        delta: `${this.formatSigned(documentsThisMonth)} ce mois`,
        deltaTone: 'positive',
        icon: DOCUMENT_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildEmployeeKpis(
    events: EnterpriseEvent[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[],
    notifications: AppNotification[]
  ): DashboardKpiCard[] {
    const myEvents = events.filter((event) =>
      event.organiserId === this.authService.currentUser?.id ||
      event.participants.some((participant) => participant.userId === this.authService.currentUser?.id)
    ).length;

    const activeReservations =
      roomReservations.filter((reservation) =>
        this.matchesCurrentUser(reservation.userId, '', reservation.userName)
      ).filter((reservation) => ['APPROVED', 'PENDING'].includes(reservation.status)).length +
      equipmentReservations.filter((reservation) =>
        this.matchesCurrentUser(reservation.userId, '', reservation.userName)
      ).filter((reservation) => ['APPROVED', 'IN_USE'].includes(reservation.status)).length;

    const userInvitations = invitations.filter((invitation) =>
      this.matchesCurrentUser(
        invitation.recipientId,
        invitation.recipientEmail,
        invitation.recipientName
      ) || invitation.senderId === this.authService.currentUser?.id
    );
    const pendingInvitations = userInvitations.filter(
      (invitation) => invitation.status === InvitationStatus.PENDING
    ).length;

    const userInterventions = interventions.filter((intervention) =>
      this.matchesCurrentUser(
        intervention.requesterId,
        intervention.requesterEmail,
        intervention.requesterName
      )
    );
    const inProgressInterventions = userInterventions.filter((intervention) =>
      [InterventionStatus.ASSIGNED, InterventionStatus.IN_PROGRESS].includes(
        intervention.status
      )
    ).length;

    const unreadNotifications = notifications.filter(
      (notification) => !notification.isRead
    ).length;

    return [
      {
        label: 'Mes événements',
        value: myEvents,
        delta: 'Planifiés',
        deltaTone: 'positive',
        icon: EVENT_ACTION_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Mes réservations',
        value: activeReservations,
        delta: 'Actives',
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Mes invitations',
        value: userInvitations.length,
        delta: `${pendingInvitations} en attente`,
        deltaTone: pendingInvitations > 0 ? 'negative' : 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Mes interventions',
        value: userInterventions.length,
        delta: 'En cours',
        deltaTone: 'positive',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Notifications',
        value: unreadNotifications,
        delta: 'Non lues',
        deltaTone: unreadNotifications > 0 ? 'negative' : 'positive',
        icon: NOTIFICATION_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildManagerResponsibleKpis(
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    events: EnterpriseEvent[],
    userStats: UserStatistics
  ): DashboardKpiCard[] {
    const weeklyReservations =
      roomReservations.filter(
        (reservation) =>
          this.isInCurrentWeek(reservation.startDate) &&
          ['PENDING', 'APPROVED', 'COMPLETED'].includes(reservation.status)
      ).length +
      equipmentReservations.filter(
        (reservation) =>
          this.isInCurrentWeek(reservation.startDate) &&
          ['PENDING', 'APPROVED', 'IN_USE', 'RETURNED'].includes(
            reservation.status
          )
      ).length;

    const highPriorityInterventions = interventions.filter(
      (intervention) =>
        [
          InterventionStatus.OPEN,
          InterventionStatus.ASSIGNED,
          InterventionStatus.IN_PROGRESS,
        ].includes(intervention.status) &&
        ['HIGH', 'CRITICAL'].includes(intervention.priority)
    ).length;

    const monthlyUpcomingEvents = events.filter(
      (event) =>
        event.status === 'PUBLISHED' && this.isInCurrentMonth(event.startDate)
    ).length;

    return [
      {
        label: 'Mon equipe',
        value: userStats.activeUsers,
        delta: 'Actifs aujourd\'hui',
        deltaTone: 'positive',
        icon: USERS_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Reservations equipe',
        value: weeklyReservations,
        delta: 'Cette semaine',
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Interventions en cours',
        value: highPriorityInterventions,
        delta: 'Priorite haute',
        deltaTone: highPriorityInterventions > 0 ? 'negative' : 'positive',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Evenements a venir',
        value: monthlyUpcomingEvents,
        delta: 'Ce mois',
        deltaTone: 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildRoleSpecificKpis(
    role: AppRole,
    events: EnterpriseEvent[],
    invitations: Invitation[],
    documents: GedDocument[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    rooms: Room[],
    equipment: Equipment[],
    auditLogs: GedAuditLogEntry[],
    userStats: UserStatistics,
    itEquipments: ItEquipment[],
    itInterventions: ItIntervention[],
  ): DashboardKpiCard[] {
    if (role === 'MANAGER') {
      return this.buildManagerKpis(events);
    }
    if (role === 'SECURITY_MANAGER') {
      return this.buildSecurityManagerKpis(roomReservations, equipmentReservations);
    }
    if (role === 'ROOM_MANAGER') {
      return this.buildRoomManagerKpis(rooms, equipment, roomReservations);
    }
    if (role === 'QUALITY_MANAGER') {
      return this.buildQualityManagerKpis(documents, auditLogs);
    }
    if (role === 'DSN_DIRECTOR') {
      return this.buildDsnDirectorKpis(events, invitations);
    }
    if (role === 'IT_MANAGER') {
      return this.buildItManagerKpis(itEquipments, itInterventions);
    }

    return this.buildManagerResponsibleKpis(
      roomReservations,
      equipmentReservations,
      interventions,
      events,
      userStats,
    );
  }

  private buildManagerKpis(events: EnterpriseEvent[]): DashboardKpiCard[] {
    const pendingEvents = events.filter((event) => event.status === 'SUBMITTED').length;
    const approvedEvents = events.filter((event) => event.status === 'PUBLISHED').length;
    const rejectedEvents = events.filter((event) => event.status === 'CANCELLED').length;
    const completedEvents = events.filter((event) => event.status === 'COMPLETED').length;

    return [
      {
        label: 'Événements en attente',
        value: pendingEvents,
        delta: 'Validation requise',
        deltaTone: pendingEvents > 0 ? 'negative' : 'positive',
        icon: EVENT_ACTION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Événements validés',
        value: approvedEvents,
        delta: 'Publiés',
        deltaTone: 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Événements refusés',
        value: rejectedEvents,
        delta: 'Annulés',
        deltaTone: rejectedEvents > 0 ? 'negative' : 'positive',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Événements terminés',
        value: completedEvents,
        delta: 'Historique',
        deltaTone: 'positive',
        icon: REPORT_ACTION_ICON,
        iconColorClass: 'text-blue-light-500',
      },
    ];
  }

  private buildSecurityManagerKpis(
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
  ): DashboardKpiCard[] {
    const pending = roomReservations.filter((reservation) => reservation.status === 'PENDING').length
      + equipmentReservations.filter((reservation) => reservation.status === 'PENDING').length;
    const approved = roomReservations.filter((reservation) => reservation.status === 'APPROVED').length
      + equipmentReservations.filter((reservation) => reservation.status === 'APPROVED' || reservation.status === 'IN_USE').length;
    const rejected = roomReservations.filter((reservation) => reservation.status === 'REJECTED').length
      + equipmentReservations.filter((reservation) => reservation.status === 'CANCELLED').length;

    const byRoom = roomReservations
      .filter((reservation) => reservation.status === 'APPROVED')
      .reduce((accumulator, reservation) => {
        const key = reservation.roomName || 'N/A';
        return { ...accumulator, [key]: (accumulator[key] ?? 0) + 1 };
      }, {} as Record<string, number>);
    const maxByRoom = Object.values(byRoom).length > 0 ? Math.max(...Object.values(byRoom)) : 0;

    return [
      {
        label: 'Réservations en attente',
        value: pending,
        delta: 'À contrôler',
        deltaTone: pending > 0 ? 'negative' : 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Réservations validées',
        value: approved,
        delta: 'Confirmées',
        deltaTone: 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Réservations refusées',
        value: rejected,
        delta: 'Rejetées',
        deltaTone: rejected > 0 ? 'negative' : 'positive',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Pic par salle',
        value: maxByRoom,
        delta: 'Occupation max',
        deltaTone: 'positive',
        icon: REPORT_ACTION_ICON,
        iconColorClass: 'text-blue-light-500',
      },
    ];
  }

  private buildRoomManagerKpis(
    rooms: Room[],
    equipment: Equipment[],
    roomReservations: RoomReservation[],
  ): DashboardKpiCard[] {
    const availableRooms = rooms.filter((room) =>
      room.isActive && (room.status === 'DISPONIBLE' || !room.status)
    ).length;
    const maintenanceRooms = rooms.filter((room) =>
      room.status === 'MAINTENANCE' || !room.isActive
    ).length;

    const equipmentAvailable = equipment.filter((item) =>
      item.status === 'AVAILABLE' && (item.availableQuantity ?? item.totalQuantity ?? 0) > 0
    ).length;
    const equipmentMaintenance = equipment.filter((item) => item.status === 'MAINTENANCE').length;

    const currentMonthReservations = roomReservations.filter((reservation) =>
      this.isInCurrentMonth(reservation.startDate) && ['APPROVED', 'PENDING', 'COMPLETED'].includes(reservation.status)
    ).length;

    return [
      {
        label: 'Nombre de salles',
        value: rooms.length,
        delta: `${availableRooms} disponibles`,
        deltaTone: 'positive',
        icon: USERS_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Salles maintenance',
        value: maintenanceRooms,
        delta: 'À traiter',
        deltaTone: maintenanceRooms > 0 ? 'negative' : 'positive',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Équipements disponibles',
        value: equipmentAvailable,
        delta: `${equipmentMaintenance} maintenance`,
        deltaTone: 'positive',
        icon: TOOL_ACTION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Occupation du mois',
        value: currentMonthReservations,
        delta: 'Réservations salle',
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildQualityManagerKpis(
    documents: GedDocument[],
    auditLogs: GedAuditLogEntry[],
  ): DashboardKpiCard[] {
    const publishedDocuments = documents.filter((document) => /publie|valide/i.test(document.gedStatus ?? '')).length;
    const archivedDocuments = documents.filter((document) => document.isArchived || /archive|obsolete/i.test(document.gedStatus ?? '')).length;
    const confidentialDocuments = documents.filter((document) => document.confidentialityLevel === 'CONFIDENTIAL').length;
    const auditActions = auditLogs.length;

    return [
      {
        label: 'Documents GED',
        value: documents.length,
        delta: `${publishedDocuments} publiés`,
        deltaTone: 'positive',
        icon: DOCUMENT_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Documents archivés',
        value: archivedDocuments,
        delta: 'Historique',
        deltaTone: 'positive',
        icon: REPORT_ACTION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Confidentiels',
        value: confidentialDocuments,
        delta: 'Niveau élevé',
        deltaTone: confidentialDocuments > 0 ? 'negative' : 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Audit GED récent',
        value: auditActions,
        delta: 'Traçabilité',
        deltaTone: 'positive',
        icon: NOTIFICATION_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildDsnDirectorKpis(
    events: EnterpriseEvent[],
    invitations: Invitation[],
  ): DashboardKpiCard[] {
    const partnerEvents = events.filter((event) => event.hasExternalPartners).length;
    const partnerInvitations = invitations.filter((invitation) => invitation.isExternalPartner);
    const pendingAccess = partnerInvitations.filter((invitation) => !invitation.isVerifiedByDsn).length;
    const approvedAccess = partnerInvitations.filter((invitation) => invitation.isVerifiedByDsn).length;
    const refusedAccess = partnerInvitations.filter((invitation) =>
      invitation.status === InvitationStatus.DECLINED || invitation.status === InvitationStatus.CANCELLED
    ).length;

    const recentDecisions = partnerInvitations.filter((invitation) => {
      if (!invitation.respondedAt) {
        return false;
      }
      const diff = Date.now() - invitation.respondedAt.getTime();
      return diff <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    return [
      {
        label: 'Événements partenaires',
        value: partnerEvents,
        delta: 'Externe',
        deltaTone: 'positive',
        icon: EVENT_ACTION_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Accès en attente',
        value: pendingAccess,
        delta: 'Validation DSN',
        deltaTone: pendingAccess > 0 ? 'negative' : 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Accès validés',
        value: approvedAccess,
        delta: `${refusedAccess} refusés`,
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Décisions récentes',
        value: recentDecisions,
        delta: '30 derniers jours',
        deltaTone: 'positive',
        icon: REPORT_ACTION_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildItManagerKpis(
    itEquipments: ItEquipment[],
    itInterventions: ItIntervention[],
  ): DashboardKpiCard[] {
    const operationalEquipments = itEquipments.filter(
      (equipment) => equipment.state === 'OPERATIONAL'
    ).length;
    const maintenanceEquipments = itEquipments.filter(
      (equipment) => equipment.state === 'IN_MAINTENANCE' || equipment.state === 'IN_REPAIR'
    ).length;
    const pendingInterventions = itInterventions.filter((intervention) =>
      intervention.itWorkflowStatus === 'IT_PROCESSING_PENDING'
    ).length;
    const inProgressInterventions = itInterventions.filter((intervention) =>
      intervention.itWorkflowStatus === 'IT_IN_CHARGE' ||
      intervention.itWorkflowStatus === 'IT_IN_PROGRESS'
    ).length;

    return [
      {
        label: 'Equipements IT',
        value: itEquipments.length,
        delta: `${operationalEquipments} operationnels`,
        deltaTone: 'positive',
        icon: TOOL_ACTION_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Maintenance IT',
        value: maintenanceEquipments,
        delta: 'A traiter',
        deltaTone: maintenanceEquipments > 0 ? 'negative' : 'positive',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Interventions IT en attente',
        value: pendingInterventions,
        delta: 'File de traitement',
        deltaTone: pendingInterventions > 0 ? 'negative' : 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Interventions IT en cours',
        value: inProgressInterventions,
        delta: 'Prises en charge',
        deltaTone: 'positive',
        icon: REPORT_ACTION_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildRoleSpecificRecentActivities(
    role: AppRole,
    documents: GedDocument[],
    invitations: Invitation[],
    roomReservations: RoomReservation[],
    events: EnterpriseEvent[],
    interventions: Intervention[],
    itInterventions: ItIntervention[],
    itEquipments: ItEquipment[],
  ): ActivityItem[] {
    if (role === 'MANAGER') {
      const pending = events
        .filter((event) => event.status === 'SUBMITTED')
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, 3);

      return pending.map((event) => ({
        title: `Validation requise: ${event.title}`,
        timestamp: event.updatedAt,
        timeAgo: this.formatTimeAgo(event.updatedAt),
        tag: 'Validation',
        tagClass: 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      }));
    }

    if (role === 'SECURITY_MANAGER') {
      const pendingReservations = roomReservations
        .filter((reservation) => reservation.status === 'PENDING')
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, 3);

      return pendingReservations.map((reservation) => ({
        title: `Contrôle sécurité: ${reservation.roomName} (${reservation.userName})`,
        timestamp: reservation.updatedAt,
        timeAgo: this.formatTimeAgo(reservation.updatedAt),
        tag: 'Réservation',
        tagClass: 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      }));
    }

    if (role === 'QUALITY_MANAGER') {
      const latestDocuments = documents
        .slice()
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, 3);

      return latestDocuments.map((document) => ({
        title: `Suivi qualité: ${document.title}`,
        timestamp: document.updatedAt,
        timeAgo: this.formatTimeAgo(document.updatedAt),
        tag: 'GED',
        tagClass: 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      }));
    }

    if (role === 'DSN_DIRECTOR') {
      const partnerActions = invitations
        .filter((invitation) => invitation.isExternalPartner)
        .sort((left, right) => right.sentAt.getTime() - left.sentAt.getTime())
        .slice(0, 3);

      return partnerActions.map((invitation) => ({
        title: `Partenaire: ${invitation.recipientName} (${invitation.eventTitle})`,
        timestamp: invitation.sentAt,
        timeAgo: this.formatTimeAgo(invitation.sentAt),
        tag: invitation.isVerifiedByDsn ? 'Validé' : 'À valider',
        tagClass: invitation.isVerifiedByDsn
          ? 'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300'
          : 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: invitation.isVerifiedByDsn ? 'bg-success-500' : 'bg-warning-500',
      }));
    }

    if (role === 'ROOM_MANAGER') {
      const latestReservations = roomReservations
        .slice()
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, 3);

      return latestReservations.map((reservation) => ({
        title: `Salle ${reservation.roomName} - ${reservation.status}`,
        timestamp: reservation.updatedAt,
        timeAgo: this.formatTimeAgo(reservation.updatedAt),
        tag: 'Salle',
        tagClass: 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      }));
    }

    if (role === 'IT_MANAGER') {
      return this.buildItManagerRecentActivities(itInterventions, itEquipments);
    }

    return this.buildManagerResponsibleRecentActivities(
      documents,
      invitations,
      roomReservations
    );
  }

  private getRoleQuickActions(role: AppRole): QuickAction[] {
    if (role === 'MANAGER') {
      return [
        { label: 'Valider événements', route: '/events', icon: EVENT_ACTION_ICON },
        { label: 'Suivre invitations', route: '/invitations', icon: INVITATION_ICON },
        { label: 'Voir tableau de bord', route: '/dashboard', icon: REPORT_ACTION_ICON },
        { label: 'Consulter profil', route: '/profile', icon: USER_ACTION_ICON },
      ];
    }

    if (role === 'SECURITY_MANAGER') {
      return [
        { label: 'Réservations salles', route: '/reservations/salles', icon: RESERVATION_ACTION_ICON },
        { label: 'Réservations équipements', route: '/reservations/equipements', icon: RESERVATION_ACTION_ICON },
        { label: 'Interventions', route: '/interventions', icon: TOOL_ACTION_ICON },
        { label: 'Notifications', route: '/notifications', icon: NOTIFICATION_ICON },
      ];
    }

    if (role === 'ROOM_MANAGER') {
      return [
        { label: 'Gérer les salles', route: '/reservations/salles', icon: RESERVATION_ACTION_ICON },
        { label: 'Gérer équipements', route: '/reservations/equipements', icon: TOOL_ACTION_ICON },
        { label: 'Créer événement', route: '/events', icon: EVENT_ACTION_ICON },
        { label: 'Notifications', route: '/notifications', icon: NOTIFICATION_ICON },
      ];
    }

    if (role === 'IT_MANAGER') {
      return [
        { label: 'Parc IT', route: '/it/equipements', icon: TOOL_ACTION_ICON },
        { label: 'Interventions IT', route: '/it/interventions', icon: INTERVENTION_ICON },
        { label: 'Notifications', route: '/notifications', icon: NOTIFICATION_ICON },
        { label: 'Profil', route: '/profile', icon: USER_ACTION_ICON },
      ];
    }

    if (role === 'QUALITY_MANAGER') {
      return [
        { label: 'Ouvrir GED', route: '/documents', icon: DOCUMENT_ICON },
        { label: 'Voir audit', route: '/documents', icon: REPORT_ACTION_ICON, queryParams: { tab: 'audit' } },
        { label: 'Événements', route: '/events', icon: EVENT_ACTION_ICON },
        { label: 'Notifications', route: '/notifications', icon: NOTIFICATION_ICON },
      ];
    }

    if (role === 'DSN_DIRECTOR') {
      return [
        { label: 'Accès partenaires', route: '/invitations', icon: INVITATION_ICON },
        { label: 'Événements', route: '/events', icon: EVENT_ACTION_ICON },
        { label: 'Reporting', route: '/dashboard', icon: REPORT_ACTION_ICON },
        { label: 'Notifications', route: '/notifications', icon: NOTIFICATION_ICON },
      ];
    }

    return [...this.managerResponsibleQuickActions];
  }

  private getQuickActionDisabledReason(route: string): string | null {
    const canAccess = (roles: AppRole[], permissions?: string[]): boolean => {
      if (!this.authService.canAccess(roles)) {
        return false;
      }
      if (!permissions || permissions.length === 0) {
        return true;
      }
      return this.authService.hasAllPermissions(permissions);
    };

    if (route === '/admin' || route === '/admin/workflows') {
      return canAccess(['ADMIN'], ['VIEW_USERS_MODULE']) ? null : 'Action reservee a l administrateur.';
    }

    if (route === '/documents') {
      return canAccess(
        ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'IT_MANAGER', 'SECURITY_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER'],
        ['VIEW_GED_MODULE'],
      ) ? null : 'Acces GED non autorise pour ce role.';
    }

    if (route === '/events') {
      return canAccess(
        ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'IT_MANAGER', 'SECURITY_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER'],
        ['VIEW_EVENTS_MODULE'],
      ) ? null : 'Acces Evenements non autorise pour ce role.';
    }

    if (route === '/invitations') {
      return canAccess(
        ['ADMIN', 'EMPLOYEE', 'MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER', 'SECURITY_MANAGER'],
        ['VIEW_EVENTS_MODULE'],
      ) ? null : 'Acces Invitations non autorise pour ce role.';
    }

    if (route === '/reservations/salles' || route === '/reservations/equipements') {
      return canAccess(
        ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'SECURITY_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER']
      ) ? null : 'Acces Reservations non autorise pour ce role.';
    }

    if (route === '/interventions') {
      return canAccess(['ADMIN', 'ROOM_MANAGER'], ['VIEW_INTERVENTIONS_MODULE'])
        ? null
        : 'Action indisponible pour ce role (interventions logistiques).';
    }

    if (route === '/it/interventions') {
      return canAccess(['ADMIN', 'EMPLOYEE', 'MANAGER', 'DSN_DIRECTOR', 'IT_MANAGER'], ['VIEW_INTERVENTIONS_MODULE'])
        ? null
        : 'Action indisponible pour ce role (interventions IT).';
    }

    if (route === '/it/equipements') {
      return canAccess(['ADMIN', 'IT_MANAGER']) ? null : 'Action reservee au responsable IT.';
    }

    if (route === '/notifications') {
      return canAccess(
        ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'IT_MANAGER', 'SECURITY_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER']
      ) ? null : 'Acces notifications non autorise.';
    }

    if (route === '/dashboard' || route === '/reporting') {
      return canAccess(
        ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'IT_MANAGER', 'SECURITY_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER'],
        ['VIEW_REPORTS_MODULE'],
      ) ? null : 'Acces dashboard non autorise.';
    }

    if (route === '/profile') {
      return canAccess(
        ['ADMIN', 'EMPLOYEE', 'MANAGER', 'ROOM_MANAGER', 'IT_MANAGER', 'SECURITY_MANAGER', 'DSN_DIRECTOR', 'QUALITY_MANAGER']
      ) ? null : 'Acces profil non autorise.';
    }

    return null;
  }

  private buildUpcomingEvents(events: EnterpriseEvent[]): UpcomingEventItem[] {
    const now = new Date();
    return events
      .filter((event) => event.startDate >= now)
      .sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
      .slice(0, 4)
      .map((event) => ({
        id: event.id,
        title: event.title,
        dateLabel: this.formatEventDateRange(event.startDate, event.endDate),
        locationLabel: event.location || 'Non precise',
        statusLabel: this.getEventStatusLabelForDashboard(event.status),
        statusClass: this.getEventStatusClassForDashboard(event.status),
        route: '/events',
      }));
  }

  private buildRoleTasks(
    role: AppRole,
    events: EnterpriseEvent[],
    invitations: Invitation[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    documents: GedDocument[],
    itInterventions: ItIntervention[],
    notifications: AppNotification[],
  ): DashboardTaskItem[] {
    const tasks: DashboardTaskItem[] = [];

    if (role === 'ADMIN') {
      const pendingEvents = events.filter((event) => event.status === 'SUBMITTED').length;
      if (pendingEvents > 0) {
        tasks.push({
          title: 'Valider les evenements en attente',
          detail: `${pendingEvents} evenement(s) soumis a traiter`,
          tone: 'high',
          route: '/events',
        });
      }

      const unreadNotifications = notifications.filter((notification) => !notification.isRead).length;
      if (unreadNotifications > 0) {
        tasks.push({
          title: 'Consulter les notifications non lues',
          detail: `${unreadNotifications} notification(s) en attente`,
          tone: 'medium',
          route: '/notifications',
        });
      }
    }

    if (role === 'EMPLOYEE') {
      const myPendingInvites = invitations.filter((invitation) =>
        invitation.status === InvitationStatus.PENDING &&
        this.matchesCurrentUser(invitation.recipientId, invitation.recipientEmail, invitation.recipientName)
      ).length;
      if (myPendingInvites > 0) {
        tasks.push({
          title: 'Repondre a vos invitations',
          detail: `${myPendingInvites} invitation(s) en attente`,
          tone: 'high',
          route: '/invitations',
        });
      }

      const myInterventions = interventions.filter((intervention) =>
        this.matchesCurrentUser(intervention.requesterId, intervention.requesterEmail, intervention.requesterName) &&
        (intervention.status === InterventionStatus.OPEN || intervention.status === InterventionStatus.IN_PROGRESS)
      ).length;
      if (myInterventions > 0) {
        tasks.push({
          title: 'Suivre vos interventions',
          detail: `${myInterventions} demande(s) a suivre`,
          tone: 'medium',
          route: '/it/interventions',
        });
      }
    }

    if (role === 'MANAGER') {
      const pendingEvents = events.filter((event) => event.status === 'SUBMITTED').length;
      if (pendingEvents > 0) {
        tasks.push({
          title: 'Valider les demandes evenementielles',
          detail: `${pendingEvents} evenement(s) en attente de decision`,
          tone: 'high',
          route: '/events',
        });
      }
    }

    if (role === 'SECURITY_MANAGER') {
      const pendingReservations =
        roomReservations.filter((reservation) => reservation.status === 'PENDING').length +
        equipmentReservations.filter((reservation) => reservation.status === 'PENDING').length;
      if (pendingReservations > 0) {
        tasks.push({
          title: 'Controler les reservations en attente',
          detail: `${pendingReservations} reservation(s) a verifier`,
          tone: 'high',
          route: '/reservations/salles',
        });
      }
    }

    if (role === 'ROOM_MANAGER') {
      const pendingRoomReservations = roomReservations.filter((reservation) => reservation.status === 'PENDING').length;
      if (pendingRoomReservations > 0) {
        tasks.push({
          title: 'Traiter les reservations de salles',
          detail: `${pendingRoomReservations} reservation(s) salle en attente`,
          tone: 'high',
          route: '/reservations/salles',
        });
      }
    }

    if (role === 'QUALITY_MANAGER') {
      const confidentialDocuments = documents.filter((document) => document.confidentialityLevel === 'CONFIDENTIAL').length;
      if (confidentialDocuments > 0) {
        tasks.push({
          title: 'Surveiller les documents confidentiels',
          detail: `${confidentialDocuments} document(s) a controle qualite`,
          tone: 'medium',
          route: '/documents',
        });
      }
    }

    if (role === 'DSN_DIRECTOR') {
      const pendingPartnerAccess = invitations.filter(
        (invitation) => invitation.isExternalPartner && !invitation.isVerifiedByDsn
      ).length;
      if (pendingPartnerAccess > 0) {
        tasks.push({
          title: 'Valider les acces partenaires',
          detail: `${pendingPartnerAccess} acces externe(s) en attente`,
          tone: 'high',
          route: '/invitations',
        });
      }
    }

    if (role === 'IT_MANAGER') {
      const pendingItInterventions = itInterventions.filter(
        (intervention) => intervention.itWorkflowStatus === 'IT_PROCESSING_PENDING'
      ).length;
      if (pendingItInterventions > 0) {
        tasks.push({
          title: 'Prendre en charge les interventions IT',
          detail: `${pendingItInterventions} intervention(s) en file d attente`,
          tone: 'high',
          route: '/it/interventions',
        });
      }
    }

    if (tasks.length === 0) {
      tasks.push({
        title: 'Aucune validation en attente',
        detail: 'Vos files de traitement sont a jour.',
        tone: 'low',
      });
    }

    return tasks.slice(0, 5);
  }

  private formatEventDateRange(startDate: Date, endDate: Date): string {
    const start = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(startDate);

    const end = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(endDate);

    return `${start} - ${end}`;
  }

  private getEventStatusLabelForDashboard(status: EnterpriseEvent['status']): string {
    if (status === 'SUBMITTED') {
      return 'En attente';
    }
    if (status === 'PUBLISHED') {
      return 'Publie';
    }
    if (status === 'COMPLETED') {
      return 'Termine';
    }
    if (status === 'CANCELLED') {
      return 'Annule';
    }
    return status;
  }

  private getEventStatusClassForDashboard(status: EnterpriseEvent['status']): string {
    if (status === 'SUBMITTED') {
      return 'bg-warning-50 text-warning-700';
    }
    if (status === 'PUBLISHED') {
      return 'bg-success-50 text-success-700';
    }
    if (status === 'COMPLETED') {
      return 'bg-brand-50 text-brand-700';
    }
    if (status === 'CANCELLED') {
      return 'bg-error-50 text-error-700';
    }
    return 'bg-gray-100 text-gray-700';
  }

  private extractEventDates(events: EnterpriseEvent[]): Date[] {
    return events.map((event) => event.startDate);
  }

  private formatMiniCalendarMonth(referenceDate: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(referenceDate);
  }

  private buildMiniCalendarCells(referenceDate: Date, eventDates: Date[]): MiniCalendarCell[] {
    const firstDayOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const lastDayOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
    const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();
    const eventCounts = new Map<string, number>();
    const today = new Date();

    eventDates.forEach((date) => {
      if (
        date.getFullYear() !== referenceDate.getFullYear() ||
        date.getMonth() !== referenceDate.getMonth()
      ) {
        return;
      }

      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      eventCounts.set(key, (eventCounts.get(key) ?? 0) + 1);
    });

    const cells: MiniCalendarCell[] = [];

    for (let index = 0; index < 42; index += 1) {
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push({
          date: null,
          dayNumber: null,
          isCurrentMonth: false,
          isToday: false,
          eventCount: 0,
        });
        continue;
      }

      const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), dayNumber);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      cells.push({
        date,
        dayNumber,
        isCurrentMonth: true,
        isToday: this.isSameDay(date, today),
        eventCount: eventCounts.get(key) ?? 0,
      });
    }

    return cells;
  }

  private buildReservationSeries(
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[]
  ): ReservationMonthPoint[] {
    const now = new Date();
    const series: ReservationMonthPoint[] = [];
    const monthKeys: string[] = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const month = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      monthKeys.push(key);
      series.push({ month, rooms: 0, equipment: 0 });
    }

    roomReservations.forEach((reservation) => {
      const key = `${reservation.startDate.getFullYear()}-${reservation.startDate.getMonth()}`;
      const index = monthKeys.indexOf(key);
      if (index >= 0) {
        series[index].rooms += 1;
      }
    });

    equipmentReservations.forEach((reservation) => {
      const key = `${reservation.startDate.getFullYear()}-${reservation.startDate.getMonth()}`;
      const index = monthKeys.indexOf(key);
      if (index >= 0) {
        series[index].equipment += 1;
      }
    });

    return series;
  }

  private buildStatusSegments(interventions: Intervention[]): StatusSegment[] {
    const open = interventions.filter(
      (intervention) => intervention.status === InterventionStatus.OPEN
    ).length;
    const inProgress = interventions.filter(
      (intervention) =>
        intervention.status === InterventionStatus.ASSIGNED ||
        intervention.status === InterventionStatus.IN_PROGRESS
    ).length;
    const resolved = interventions.filter(
      (intervention) => intervention.status === InterventionStatus.RESOLVED
    ).length;
    const closed = interventions.filter(
      (intervention) => intervention.status === InterventionStatus.CLOSED
    ).length;

    const total = open + inProgress + resolved + closed;
    if (total === 0) {
      return [
        { label: 'Ouvert', percentage: 0, color: '#ef4444' },
        { label: 'En cours', percentage: 0, color: '#f59e0b' },
        { label: 'Resolu', percentage: 0, color: '#3b82f6' },
        { label: 'Ferme', percentage: 0, color: '#65a30d' },
      ];
    }

    const raw = [open, inProgress, resolved, closed].map((value) =>
      Math.round((value / total) * 100)
    );

    const adjustment = 100 - raw.reduce((sum, value) => sum + value, 0);
    if (adjustment !== 0) {
      const maxIndex = raw.indexOf(Math.max(...raw));
      raw[maxIndex] += adjustment;
    }

    return [
      { label: 'Ouvert', percentage: raw[0], color: '#ef4444' },
      { label: 'En cours', percentage: raw[1], color: '#f59e0b' },
      { label: 'Resolu', percentage: raw[2], color: '#3b82f6' },
      { label: 'Ferme', percentage: raw[3], color: '#65a30d' },
    ];
  }

  private buildStatusGradient(segments: StatusSegment[]): string {
    let cursor = 0;
    const parts = segments.map((segment) => {
      const start = cursor;
      const end = cursor + segment.percentage;
      cursor = end;
      return `${segment.color} ${start}% ${end}%`;
    });

    return `conic-gradient(${parts.join(', ')})`;
  }

  private buildAdminRecentActivities(
    documents: GedDocument[],
    events: EnterpriseEvent[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[]
  ): ActivityItem[] {
    const activities: ActivityItem[] = [];

    roomReservations.forEach((reservation) => {
      activities.push({
        title: `${reservation.roomName} reservee par ${reservation.userName}`,
        timestamp: reservation.createdAt,
        timeAgo: this.formatTimeAgo(reservation.createdAt),
        tag: 'Salles',
        tagClass:
          'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      });
    });

    equipmentReservations.forEach((reservation) => {
      activities.push({
        title: `${reservation.equipmentName} reserve par ${reservation.userName}`,
        timestamp: reservation.createdAt,
        timeAgo: this.formatTimeAgo(reservation.createdAt),
        tag: 'Equipement',
        tagClass:
          'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300',
        dotClass: 'bg-success-500',
      });
    });

    interventions.forEach((intervention) => {
      const isCritical = intervention.priority === 'CRITICAL';
      const resolved = intervention.status === InterventionStatus.RESOLVED;
      const interventionTitle = resolved
        ? `Intervention ${intervention.id} marquee resolue`
        : intervention.title;
      activities.push({
        title: isCritical
           ? `Nouvelle intervention CRITICAL - ${intervention.title}`
          : interventionTitle,
        timestamp: intervention.updatedAt,
        timeAgo: this.formatTimeAgo(intervention.updatedAt),
        tag: resolved ? 'Resolu' : isCritical ? 'Critique' : 'Intervention',
        tagClass: resolved
          ? 'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300'
          : isCritical
            ? 'bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-300'
            : 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: resolved ? 'bg-success-500' : isCritical ? 'bg-error-500' : 'bg-warning-500',
      });
    });

    documents.forEach((document) => {
      activities.push({
        title: document.isArchived
          ? `Document ${document.title} archive`
          : `Document ${document.title} publie`,
        timestamp: document.updatedAt,
        timeAgo: this.formatTimeAgo(document.updatedAt),
        tag: 'GED',
        tagClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        dotClass: 'bg-success-500',
      });
    });

    events
      .filter((event) => event.status === 'PUBLISHED')
      .forEach((event) => {
        activities.push({
          title: `Evenement "${event.title}" publie`,
          timestamp: event.updatedAt,
          timeAgo: this.formatTimeAgo(event.updatedAt),
          tag: 'Evenement',
          tagClass:
            'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
          dotClass: 'bg-warning-500',
        });
      });

    const sorted = activities
      .sort((first, second) => second.timestamp.getTime() - first.timestamp.getTime())
      .slice(0, 5);

    return sorted;
  }

  private buildEmployeeRecentActivities(
    documents: GedDocument[],
    invitations: Invitation[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[]
  ): ActivityItem[] {
    const activities: ActivityItem[] = [];

    const activeRoomReservation = roomReservations.find(
      (reservation) =>
        this.matchesCurrentUser(reservation.userId, '', reservation.userName) &&
        reservation.status === 'APPROVED'
    );
    if (activeRoomReservation) {
      activities.push({
        title: `Votre reservation ${activeRoomReservation.roomName} confirmee`,
        timestamp: activeRoomReservation.updatedAt,
        timeAgo: this.formatTimeAgo(activeRoomReservation.updatedAt),
        tag: 'Confirme',
        tagClass:
          'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300',
        dotClass: 'bg-success-500',
      });
    }

    const pendingInvitation = invitations.find(
      (invitation) =>
        invitation.status === InvitationStatus.PENDING &&
        this.matchesCurrentUser(
          invitation.recipientId,
          invitation.recipientEmail,
          invitation.recipientName
        )
    );
    if (pendingInvitation) {
      activities.push({
        title: `Invitation a ${pendingInvitation.eventTitle} - repondre avant vendredi`,
        timestamp: pendingInvitation.sentAt,
        timeAgo: this.formatTimeAgo(pendingInvitation.sentAt),
        tag: 'Invitation',
        tagClass:
          'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      });
    }

    const recentSharedDocument = documents
      .filter((document) => !document.isArchived)
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0];
    if (recentSharedDocument) {
      activities.push({
        title: `Nouveau document partage : ${recentSharedDocument.currentVersion.fileName}`,
        timestamp: recentSharedDocument.updatedAt,
        timeAgo: this.formatTimeAgo(recentSharedDocument.updatedAt),
        tag: 'GED',
        tagClass:
          'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      });
    }

    const inProgressIntervention = interventions.find((intervention) =>
      this.matchesCurrentUser(
        intervention.requesterId,
        intervention.requesterEmail,
        intervention.requesterName
      )
    );
    if (inProgressIntervention) {
      activities.push({
        title: `Intervention en cours : ${inProgressIntervention.title}`,
        timestamp: inProgressIntervention.updatedAt,
        timeAgo: this.formatTimeAgo(inProgressIntervention.updatedAt),
        tag: 'Intervention',
        tagClass:
          'bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-300',
        dotClass: 'bg-error-500',
      });
    }

    const recentEquipmentReservation = equipmentReservations.find(
      (reservation) =>
        this.matchesCurrentUser(reservation.userId, '', reservation.userName) &&
        ['APPROVED', 'IN_USE'].includes(reservation.status)
    );
    if (recentEquipmentReservation) {
      activities.push({
        title: `Equipement ${recentEquipmentReservation.equipmentName} reserve`,
        timestamp: recentEquipmentReservation.updatedAt,
        timeAgo: this.formatTimeAgo(recentEquipmentReservation.updatedAt),
        tag: 'Equipement',
        tagClass:
          'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300',
        dotClass: 'bg-success-500',
      });
    }

    const sorted = activities
      .sort((first, second) => second.timestamp.getTime() - first.timestamp.getTime())
      .slice(0, 3);

    return sorted;
  }

  private buildItManagerRecentActivities(
    itInterventions: ItIntervention[],
    itEquipments: ItEquipment[],
  ): ActivityItem[] {
    const activities: ActivityItem[] = [];

    const recentItInterventions = itInterventions
      .slice()
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, 3);

    recentItInterventions.forEach((intervention) => {
      const isCritical = intervention.priority === 'CRITICAL' || intervention.priority === 'HIGH';
      activities.push({
        title: `Intervention IT: ${intervention.title}`,
        timestamp: intervention.updatedAt,
        timeAgo: this.formatTimeAgo(intervention.updatedAt),
        tag: intervention.itWorkflowStatus,
        tagClass: isCritical
          ? 'bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-300'
          : 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: isCritical ? 'bg-error-500' : 'bg-blue-light-500',
      });
    });

    const maintenanceEquipment = itEquipments
      .filter((equipment) => equipment.state === 'IN_MAINTENANCE' || equipment.state === 'IN_REPAIR')
      .slice(0, 2);

    maintenanceEquipment.forEach((equipment) => {
      activities.push({
        title: `Equipement IT en maintenance: ${equipment.name}`,
        timestamp: equipment.updatedAt,
        timeAgo: this.formatTimeAgo(equipment.updatedAt),
        tag: 'Maintenance',
        tagClass: 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      });
    });

    return activities
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
      .slice(0, 5);
  }

  private buildManagerResponsibleRecentActivities(
    documents: GedDocument[],
    invitations: Invitation[],
    roomReservations: RoomReservation[]
  ): ActivityItem[] {
    const activities: ActivityItem[] = [];

    const sentInvitations = invitations.filter((invitation) =>
      this.matchesCurrentUser(invitation.senderId, '', invitation.senderName)
    );
    if (sentInvitations.length > 0) {
      const latestSent = sentInvitations
        .slice()
        .sort((first, second) => second.sentAt.getTime() - first.sentAt.getTime())[0];

      activities.push({
        title: `Invitation envoyee a ${sentInvitations.length} membre(s) pour ${latestSent.eventTitle}`,
        timestamp: latestSent.sentAt,
        timeAgo: this.formatTimeAgo(latestSent.sentAt),
        tag: 'Invitation',
        tagClass:
          'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      });
    }

    const pendingReservation = roomReservations
      .filter((reservation) => reservation.status === 'PENDING')
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0];
    if (pendingReservation) {
      activities.push({
        title: `Reservation salle ${pendingReservation.roomName} en attente d'approbation`,
        timestamp: pendingReservation.updatedAt,
        timeAgo: this.formatTimeAgo(pendingReservation.updatedAt),
        tag: 'En attente',
        tagClass:
          'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      });
    }

    const monthlyReportDocument = documents
      .filter((document) => /rapport/i.test(document.title))
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0];
    if (monthlyReportDocument) {
      activities.push({
        title: 'Rapport mensuel equipe disponible',
        timestamp: monthlyReportDocument.updatedAt,
        timeAgo: this.formatTimeAgo(monthlyReportDocument.updatedAt),
        tag: 'Rapport',
        tagClass:
          'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300',
        dotClass: 'bg-lime-600',
      });
    }

    const sorted = activities
      .sort((first, second) => second.timestamp.getTime() - first.timestamp.getTime())
      .slice(0, 3);

    return sorted;
  }

  private matchesCurrentUser(
    targetUserId?: string,
    targetEmail?: string,
    targetName?: string
  ): boolean {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return false;
    }

    const normalizedName = `${currentUser.firstName} ${currentUser.lastName}`
      .trim()
      .toLowerCase();

    return (
      (targetUserId ? targetUserId === currentUser.id : false) ||
      (targetEmail
        ? targetEmail.toLowerCase() === currentUser.email.toLowerCase()
        : false) ||
      (targetName
        ? targetName.toLowerCase().includes(normalizedName)
        : false)
    );
  }

  private isInCurrentWeek(date: Date): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const daysFromMonday = (currentDay + 6) % 7;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return date >= weekStart && date < weekEnd;
  }

  private isInCurrentMonth(date: Date): boolean {
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  private countInCurrentMonth(dates: Date[]): number {
    const now = new Date();
    return dates.filter(
      (date) =>
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
    ).length;
  }

  private isSameDay(first: Date, second: Date): boolean {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  private formatSigned(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }

  private formatTimeAgo(date: Date): string {
    const now = Date.now();
    const diffMs = Math.max(now - date.getTime(), 0);
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 60) {
      return `${Math.max(diffMinutes, 1)} min`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} j`;
  }
}
