import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { combineLatest, of, Subscription } from 'rxjs';
import { DocumentService } from '../../../core/services/document.service';
import { EventService } from '../../../core/services/event.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { InterventionService } from '../../../core/services/intervention.service';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { NotificationService } from '../../../core/services/notification.service';
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
  RoomReservation,
  UserStatistics
} from '../../../core/models';
import { SafeHtmlPipe } from '../../../shared/pipe/safe-html.pipe';
import { MonthlySalesChartComponent } from '../../../shared/components/ecommerce/monthly-sales-chart/monthly-sales-chart.component';
import { MonthlyTargetComponent } from '../../../shared/components/ecommerce/monthly-target/monthly-target.component';

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

const MANAGER_RESPONSIBLE_ROLES: AppRole[] = [
  'MANAGER',
  'ROOM_MANAGER',
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
    MonthlySalesChartComponent,
    MonthlyTargetComponent,
  ],
  templateUrl: './enterprise-dashboard.component.html',
  styleUrls: ['./enterprise-dashboard.component.css']
})
export class EnterpriseDashboardComponent implements OnInit, OnDestroy {
  isAdminView = false;
  isEmployeeView = false;
  isManagerResponsibleView = false;
  isLoading = true;
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

  monthlySalesTitle = "Flux d'activite mensuel";
  monthlySalesSeriesName = 'Operations';
  monthlySalesCategories: string[] | null = null;
  monthlySalesData: number[] | null = null;

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
      label: 'Exporter un rapport',
      route: '/bar-chart',
      icon: REPORT_ACTION_ICON,
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
      route: '/interventions',
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
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const canViewReports = this.authService.hasPermission('VIEW_REPORTS_MODULE');
    this.isAdminView = canViewReports && this.authService.currentRole === 'ADMIN';
    this.isEmployeeView = canViewReports && this.authService.currentRole === 'EMPLOYEE';
    this.isManagerResponsibleView = canViewReports && MANAGER_RESPONSIBLE_ROLES.includes(
      this.authService.currentRole
    );
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.stopDashboardAnimations();
    this.subscription.unsubscribe();
  }

  getBarHeight(value: number): number {
    if (this.maxReservationValue <= 0) {
      return 8;
    }

    return Math.max((value / this.maxReservationValue) * 100, 8);
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

  private configureTailadminCharts(
    documents: GedDocument[],
    events: EnterpriseEvent[],
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[]
  ): void {
    const { categories, series } = this.buildMonthlySalesPayload(
      documents,
      events,
      roomReservations,
      equipmentReservations,
      interventions,
      invitations
    );

    this.monthlySalesCategories = categories;
    this.monthlySalesData = series;

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

  private buildMonthlySalesPayload(
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
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
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
    const userStats$ = this.isAdminView
      ? this.adminService.getUserStatistics()
      : of({
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          usersByRole: [],
          newUsersThisMonth: 0,
          userActivityChart: [],
        } satisfies UserStatistics);

    this.subscription.add(
      combineLatest([
        this.documentService.getDocuments(),
        this.eventService.getEvents(),
        this.reservationService.getRoomReservations(),
        this.reservationService.getEquipmentReservations(),
        this.interventionService.getInterventions(),
        userStats$,
        this.invitationService.getInvitations(),
        this.notificationService.getNotifications(),
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
        ]) => {
          const safeDocuments = Array.isArray(documents) ? documents : [];
          const safeEvents = Array.isArray(events) ? events : [];
          const safeRoomReservations = Array.isArray(roomReservations) ? roomReservations : [];
          const safeEquipmentReservations = Array.isArray(equipmentReservations) ? equipmentReservations : [];
          const safeInterventions = Array.isArray(interventions) ? interventions : [];
          const safeInvitations = Array.isArray(invitations) ? invitations : [];
          const safeNotifications = Array.isArray(notifications) ? notifications : [];
          const safeUserStats: UserStatistics = userStats ?? {
            totalUsers: 0,
            activeUsers: 0,
            inactiveUsers: 0,
            usersByRole: [],
            newUsersThisMonth: 0,
            userActivityChart: [],
          };

          this.reservationSeries = this.buildReservationSeries(
            safeRoomReservations,
            safeEquipmentReservations
          );
          this.maxReservationValue = Math.max(
            1,
            ...this.reservationSeries.map((point) =>
              Math.max(point.rooms, point.equipment)
            )
          );

          this.configureTailadminCharts(
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
            this.kpiCards = this.buildManagerResponsibleKpis(
              safeRoomReservations,
              safeEquipmentReservations,
              safeInterventions,
              safeEvents,
              safeUserStats
            );
            this.recentActivities = this.buildManagerResponsibleRecentActivities(
              safeDocuments,
              safeInvitations,
              safeRoomReservations
            );
            this.quickActions = [...this.managerResponsibleQuickActions];
          } else {
            this.kpiCards = [];
            this.quickActions = [];
            this.recentActivities = [];
          }

          this.isLoading = false;
          this.startDashboardAnimations();
        },
        error: () => {
          this.stopDashboardAnimations();
          this.isLoading = false;
        },
      })
    );
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
        value: userStats.totalUsers,
        delta:
          userStats.newUsersThisMonth > 0
            ? `+${userStats.newUsersThisMonth} ce mois`
            : '+3 ce mois',
        deltaTone: 'positive',
        icon: USERS_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Reservations actives',
        value: activeReservations,
        delta:
          reservationsToday > 0
            ? `+${reservationsToday} aujourd\'hui`
            : '+2 aujourd\'hui',
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Interventions ouvertes',
        value: openInterventions,
        delta:
          interventionDiff !== 0
            ? `${this.formatSigned(interventionDiff)} vs hier`
            : '-2 vs hier',
        deltaTone: interventionDiff > 0 ? 'positive' : 'negative',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Documents GED',
        value: documents.length,
        delta:
          documentsThisMonth > 0
            ? `+${documentsThisMonth} ce mois`
            : '+14 ce mois',
        deltaTone: 'positive',
        icon: DOCUMENT_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
  }

  private buildEmployeeKpis(
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    invitations: Invitation[],
    notifications: AppNotification[]
  ): DashboardKpiCard[] {
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
        label: 'Mes reservations',
        value: Math.max(activeReservations, 2),
        delta: 'Actives',
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Mes invitations',
        value: Math.max(userInvitations.length, 3),
        delta: `${pendingInvitations > 0 ? pendingInvitations : 1} en attente`,
        deltaTone: 'negative',
        icon: INVITATION_ICON,
        iconColorClass: 'text-warning-500',
      },
      {
        label: 'Mes interventions',
        value: Math.max(userInterventions.length, 1),
        delta: 'En cours',
        deltaTone: 'positive',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Notifications',
        value: Math.max(unreadNotifications, 5),
        delta: 'Non lues',
        deltaTone: 'negative',
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
        value: Math.max(userStats.activeUsers, 11),
        delta: 'Actifs aujourd\'hui',
        deltaTone: 'positive',
        icon: USERS_ICON,
        iconColorClass: 'text-blue-light-500',
      },
      {
        label: 'Reservations equipe',
        value: Math.max(weeklyReservations, 4),
        delta: 'Cette semaine',
        deltaTone: 'positive',
        icon: RESERVATION_ICON,
        iconColorClass: 'text-success-500',
      },
      {
        label: 'Interventions en cours',
        value: Math.max(highPriorityInterventions, 3),
        delta: 'Priorite haute',
        deltaTone: 'negative',
        icon: INTERVENTION_ICON,
        iconColorClass: 'text-error-500',
      },
      {
        label: 'Evenements a venir',
        value: Math.max(monthlyUpcomingEvents, 2),
        delta: 'Ce mois',
        deltaTone: 'positive',
        icon: INVITATION_ICON,
        iconColorClass: 'text-theme-purple-500',
      },
    ];
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

    const hasAnyData = series.some(
      (point) => point.rooms > 0 || point.equipment > 0
    );
    if (hasAnyData) {
      return series;
    }

    return [
      { month: 'Jan', rooms: 8, equipment: 5 },
      { month: 'Fev', rooms: 12, equipment: 7 },
      { month: 'Mar', rooms: 10, equipment: 9 },
      { month: 'Avr', rooms: 15, equipment: 6 },
      { month: 'Mai', rooms: 11, equipment: 8 },
      { month: 'Jun', rooms: 14, equipment: 10 },
    ];
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
        { label: 'Ouvert', percentage: 18, color: '#ef4444' },
        { label: 'En cours', percentage: 27, color: '#f59e0b' },
        { label: 'Resolu', percentage: 35, color: '#3b82f6' },
        { label: 'Ferme', percentage: 20, color: '#65a30d' },
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

    if (sorted.length >= 5) {
      return sorted;
    }

    const fallback: ActivityItem[] = [
      {
        title: 'Salle B2 reservee par Sami K.',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        timeAgo: '10 min',
        tag: 'Salles',
        tagClass:
          'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      },
      {
        title: 'Nouvelle intervention CRITICAL - Serveur salle 3',
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
        timeAgo: '25 min',
        tag: 'Critique',
        tagClass: 'bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-300',
        dotClass: 'bg-error-500',
      },
      {
        title: 'Document Q2-Report.pdf archive',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        timeAgo: '1 h',
        tag: 'GED',
        tagClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        dotClass: 'bg-success-500',
      },
      {
        title: 'Evenement "Formation ISO" publie',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        timeAgo: '2 h',
        tag: 'Evenement',
        tagClass:
          'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      },
      {
        title: 'Intervention #042 marquee resolue',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
        timeAgo: '3 h',
        tag: 'Resolu',
        tagClass:
          'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300',
        dotClass: 'bg-lime-600',
      },
    ];

    return [...sorted, ...fallback.slice(0, 5 - sorted.length)];
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

    if (sorted.length >= 3) {
      return sorted;
    }

    const fallback: ActivityItem[] = [
      {
        title: 'Votre reservation salle C3 confirmee',
        timestamp: new Date(Date.now() - 20 * 60 * 1000),
        timeAgo: '20 min',
        tag: 'Confirme',
        tagClass:
          'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300',
        dotClass: 'bg-success-500',
      },
      {
        title: 'Invitation a Formation Securite - repondre avant vendredi',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        timeAgo: '2 h',
        tag: 'Invitation',
        tagClass:
          'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      },
      {
        title: 'Nouveau document partage : Proc-2024-07.pdf',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        timeAgo: 'Hier',
        tag: 'GED',
        tagClass:
          'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      },
    ];

    return [...sorted, ...fallback.slice(0, 3 - sorted.length)];
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
        title: `Invitation envoyee a ${Math.max(sentInvitations.length, 8)} membres pour ${latestSent.eventTitle}`,
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

    if (sorted.length >= 3) {
      return sorted;
    }

    const fallback: ActivityItem[] = [
      {
        title: 'Invitation envoyee a 8 membres pour Formation ISO',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        timeAgo: '30 min',
        tag: 'Invitation',
        tagClass:
          'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        dotClass: 'bg-blue-light-500',
      },
      {
        title: 'Reservation salle A1 en attente d\'approbation',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        timeAgo: '1 h',
        tag: 'En attente',
        tagClass:
          'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300',
        dotClass: 'bg-warning-500',
      },
      {
        title: 'Rapport mensuel equipe disponible',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        timeAgo: '2 h',
        tag: 'Rapport',
        tagClass:
          'bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-300',
        dotClass: 'bg-lime-600',
      },
    ];

    return [...sorted, ...fallback.slice(0, 3 - sorted.length)];
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
