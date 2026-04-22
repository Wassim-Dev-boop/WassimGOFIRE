
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { combineLatest, of, Subscription } from 'rxjs';
import { DropdownComponent } from '../../../shared/components/ui/dropdown/dropdown.component';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentService } from '../../../core/services/document.service';
import { InterventionService } from '../../../core/services/intervention.service';
import { ReservationService } from '../../../core/services/reservation.service';
import {
  AppRole,
  Document as GedDocument,
  EquipmentReservation,
  Intervention,
  InterventionStatus,
  RoomReservation,
  User,
  UserRole
} from '../../../core/models';

type ReportRoleView = 'admin' | 'employee' | 'managerResponsible' | 'unknown';
type ReportModuleFilter = 'ALL' | 'RESERVATIONS' | 'INTERVENTIONS' | 'DOCUMENTS';

interface ReportMonthOption {
  key: string;
  label: string;
  monthName: string;
}

interface KpiCard {
  key: 'rooms' | 'equipment' | 'interventions' | 'resolution' | 'documents';
  label: string;
  value: string | number;
  deltaLabel: string;
  deltaTone: 'positive' | 'negative';
}

interface RankedStat {
  label: string;
  value: number;
  colorClass: string;
}

interface UserActivityStat {
  name: string;
  initials: string;
  actions: number;
  avatarClass: string;
  badgeClass: string;
}

interface ReportSnapshot {
  rooms: number;
  roomsPrev: number;
  equipment: number;
  equipmentPrev: number;
  interventions: number;
  interventionsPrev: number;
  resolution: number;
  resolutionPrev: number;
  documents: number;
  documentsPrev: number;
  roomTop: RankedStat[];
  interventionTop: RankedStat[];
  equipmentTop: RankedStat[];
  userTop: UserActivityStat[];
}

const MANAGER_RESPONSIBLE_ROLES: AppRole[] = [
  'MANAGER',
  'ROOM_MANAGER',
  'SECURITY_MANAGER',
  'DSN_DIRECTOR',
  'QUALITY_MANAGER'
];

const ROOM_COLORS = ['bg-blue-500', 'bg-blue-400', 'bg-sky-400', 'bg-indigo-400', 'bg-cyan-300'];
const INTERVENTION_COLORS = ['bg-red-500', 'bg-amber-400', 'bg-yellow-400', 'bg-rose-300', 'bg-gray-300'];
const EQUIPMENT_COLORS = ['bg-emerald-500', 'bg-teal-400', 'bg-cyan-400', 'bg-green-300', 'bg-lime-300'];
const USER_AVATAR_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
];
const USER_BADGE_CLASSES = [
  'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-200',
  'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
];

@Component({
  selector: 'app-bar-chart',
  imports: [
    CommonModule,
    FormsModule,
    DropdownComponent
  ],
  templateUrl: './bar-chart.component.html',
  styles: ``
})
export class BarChartComponent implements OnInit, OnDestroy {
  readonly monthOptions: ReportMonthOption[] = [
    { key: '2024-01', label: 'Janvier 2024', monthName: 'janvier' },
    { key: '2024-02', label: 'Fevrier 2024', monthName: 'fevrier' },
    { key: '2024-03', label: 'Mars 2024', monthName: 'mars' },
    { key: '2024-04', label: 'Avril 2024', monthName: 'avril' },
    { key: '2024-05', label: 'Mai 2024', monthName: 'mai' },
    { key: '2024-06', label: 'Juin 2024', monthName: 'juin' }
  ];

  readonly moduleOptions: Array<{ value: ReportModuleFilter; label: string }> = [
    { value: 'ALL', label: 'Tous modules' },
    { value: 'RESERVATIONS', label: 'Reservations' },
    { value: 'INTERVENTIONS', label: 'Interventions' },
    { value: 'DOCUMENTS', label: 'GED' }
  ];

  selectedMonthKey = '2024-04';
  selectedModule: ReportModuleFilter = 'ALL';

  isMonthDropdownOpen = false;
  isModuleDropdownOpen = false;

  isLoading = true;
  hasReportsAccess = false;
  isAdminView = false;
  isEmployeeView = false;
  isManagerResponsibleView = false;
  roleContextLabel = '';

  kpiCards: KpiCard[] = [];
  roomTop: RankedStat[] = [];
  interventionTop: RankedStat[] = [];
  equipmentTop: RankedStat[] = [];
  userTop: UserActivityStat[] = [];

  private documents: GedDocument[] = [];
  private roomReservations: RoomReservation[] = [];
  private equipmentReservations: EquipmentReservation[] = [];
  private interventions: Intervention[] = [];
  private users: User[] = [];
  private readonly subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private documentService: DocumentService,
    private reservationService: ReservationService,
    private interventionService: InterventionService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.resolveRoleView();
    const users$ = this.isAdminView ? this.adminService.getUsers() : of([]);

    this.subscription.add(
      combineLatest([
        this.documentService.getDocuments(),
        this.reservationService.getRoomReservations(),
        this.reservationService.getEquipmentReservations(),
        this.interventionService.getInterventions(),
        users$
      ]).subscribe({
        next: ([documents, roomReservations, equipmentReservations, interventions, users]) => {
          this.documents = Array.isArray(documents) ? documents : [];
          this.roomReservations = Array.isArray(roomReservations) ? roomReservations : [];
          this.equipmentReservations = Array.isArray(equipmentReservations) ? equipmentReservations : [];
          this.interventions = Array.isArray(interventions) ? interventions : [];
          this.users = Array.isArray(users) ? users : [];
          this.rebuildReport();
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onMonthChange(): void {
    this.rebuildReport();
  }

  onModuleChange(): void {
    this.rebuildReport();
  }

  exportPdf(): void {
    window.print();
  }

  exportCsv(): void {
    const rows: Array<Array<string | number>> = [
      ['Metric', 'Value', 'Previous month', 'Delta'],
      ['Reservations salles', this.getCardValue('rooms'), this.getPreviousMetricValue('rooms'), this.getCardDelta('rooms')],
      ['Reservations equipement', this.getCardValue('equipment'), this.getPreviousMetricValue('equipment'), this.getCardDelta('equipment')],
      ['Interventions creees', this.getCardValue('interventions'), this.getPreviousMetricValue('interventions'), this.getCardDelta('interventions')],
      ['Taux resolution', this.getCardValue('resolution'), this.getPreviousMetricValue('resolution'), this.getCardDelta('resolution')],
      ['Documents archives', this.getCardValue('documents'), this.getPreviousMetricValue('documents'), this.getCardDelta('documents')],
      [],
      ['Top rooms', 'Count'],
      ...this.roomTop.map((item) => [item.label, item.value]),
      [],
      ['Interventions by type', 'Count'],
      ...this.interventionTop.map((item) => [item.label, item.value]),
      [],
      ['Top equipment', 'Count'],
      ...this.equipmentTop.map((item) => [item.label, item.value]),
      [],
      ['Top user activity', 'Actions'],
      ...this.userTop.map((item) => [item.name, item.actions])
    ];

    const csv = rows
      .map((row) => row.map((value) => this.escapeCsv(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cptr-reports-${this.selectedMonthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  get visibleKpiCards(): KpiCard[] {
    if (this.selectedModule === 'RESERVATIONS') {
      return this.kpiCards.filter((card) => card.key === 'rooms' || card.key === 'equipment');
    }

    if (this.selectedModule === 'INTERVENTIONS') {
      return this.kpiCards.filter((card) => card.key === 'interventions' || card.key === 'resolution');
    }

    if (this.selectedModule === 'DOCUMENTS') {
      return this.kpiCards.filter((card) => card.key === 'documents');
    }

    return this.kpiCards;
  }

  get roomTopMax(): number {
    return this.getMaxValue(this.roomTop);
  }

  get interventionTopMax(): number {
    return this.getMaxValue(this.interventionTop);
  }

  get equipmentTopMax(): number {
    return this.getMaxValue(this.equipmentTop);
  }

  get selectedMonthLabel(): string {
    const month = this.monthOptions.find((item) => item.key === this.selectedMonthKey);
    return month?.label ?? 'Periode';
  }

  get selectedModuleLabel(): string {
    const module = this.moduleOptions.find((item) => item.value === this.selectedModule);
    return module?.label ?? 'Tous modules';
  }

  toggleMonthDropdown(): void {
    this.isMonthDropdownOpen = !this.isMonthDropdownOpen;
    if (this.isMonthDropdownOpen) {
      this.isModuleDropdownOpen = false;
    }
  }

  closeMonthDropdown(): void {
    this.isMonthDropdownOpen = false;
  }

  toggleModuleDropdown(): void {
    this.isModuleDropdownOpen = !this.isModuleDropdownOpen;
    if (this.isModuleDropdownOpen) {
      this.isMonthDropdownOpen = false;
    }
  }

  closeModuleDropdown(): void {
    this.isModuleDropdownOpen = false;
  }

  selectMonth(monthKey: string): void {
    if (this.selectedMonthKey !== monthKey) {
      this.selectedMonthKey = monthKey;
      this.onMonthChange();
    }

    this.closeMonthDropdown();
  }

  selectModule(moduleValue: ReportModuleFilter): void {
    if (this.selectedModule !== moduleValue) {
      this.selectedModule = moduleValue;
      this.onModuleChange();
    }

    this.closeModuleDropdown();
  }

  getBarWidth(value: number, maxValue: number): number {
    if (maxValue <= 0) {
      return 0;
    }

    return Math.max(8, Math.round((value / maxValue) * 100));
  }

  trackByCardKey(_: number, card: KpiCard): string {
    return card.key;
  }

  trackByLabel(_: number, item: RankedStat): string {
    return item.label;
  }

  trackByUser(_: number, item: UserActivityStat): string {
    return item.name;
  }

  private resolveRoleView(): void {
    const currentRole = this.authService.currentRole;
    const canViewReports = this.authService.hasPermission('VIEW_REPORTS_MODULE');
    this.isAdminView = currentRole === 'ADMIN';
    this.isEmployeeView = currentRole === 'EMPLOYEE';
    this.isManagerResponsibleView = MANAGER_RESPONSIBLE_ROLES.includes(currentRole);
    this.hasReportsAccess = canViewReports && (this.isAdminView || this.isEmployeeView || this.isManagerResponsibleView);
    this.roleContextLabel = this.authService.roleLabels[currentRole] ?? currentRole;
  }

  private rebuildReport(): void {
    if (!this.hasReportsAccess) {
      this.kpiCards = [];
      this.roomTop = [];
      this.interventionTop = [];
      this.equipmentTop = [];
      this.userTop = [];
      return;
    }

    const roleView = this.getRoleView();
    const liveSnapshot = this.buildLiveSnapshot(roleView);
    const fallbackSnapshot = this.getFallbackSnapshot(roleView);
    const mergedSnapshot = this.mergeSnapshot(liveSnapshot, fallbackSnapshot);

    this.kpiCards = this.buildKpiCards(mergedSnapshot);
    this.roomTop = mergedSnapshot.roomTop;
    this.interventionTop = mergedSnapshot.interventionTop;
    this.equipmentTop = mergedSnapshot.equipmentTop;
    this.userTop = mergedSnapshot.userTop;
  }

  private getRoleView(): ReportRoleView {
    if (this.isAdminView) {
      return 'admin';
    }
    if (this.isEmployeeView) {
      return 'employee';
    }
    if (this.isManagerResponsibleView) {
      return 'managerResponsible';
    }
    return 'unknown';
  }

  private buildLiveSnapshot(roleView: ReportRoleView): ReportSnapshot {
    const currentMonthKey = this.selectedMonthKey;
    const previousMonthKey = this.getPreviousMonthKey(this.selectedMonthKey);

    const scopedRooms = this.scopeRoomReservations(roleView);
    const scopedEquipment = this.scopeEquipmentReservations(roleView);
    const scopedInterventions = this.scopeInterventions(roleView);
    const scopedDocuments = this.scopeDocuments(roleView);

    const monthRooms = scopedRooms.filter((item) => this.inMonth(item.startDate, currentMonthKey));
    const prevMonthRooms = scopedRooms.filter((item) => this.inMonth(item.startDate, previousMonthKey));

    const monthEquipment = scopedEquipment.filter((item) => this.inMonth(item.startDate, currentMonthKey));
    const prevMonthEquipment = scopedEquipment.filter((item) => this.inMonth(item.startDate, previousMonthKey));

    const monthInterventions = scopedInterventions.filter((item) => this.inMonth(item.createdAt, currentMonthKey));
    const prevMonthInterventions = scopedInterventions.filter((item) => this.inMonth(item.createdAt, previousMonthKey));

    const monthArchivedDocs = scopedDocuments.filter(
      (document) => this.isArchivedDocument(document) && this.inMonth(document.updatedAt, currentMonthKey)
    );
    const prevMonthArchivedDocs = scopedDocuments.filter(
      (document) => this.isArchivedDocument(document) && this.inMonth(document.updatedAt, previousMonthKey)
    );

    const resolvedThisMonth = monthInterventions.filter((item) => this.isResolvedIntervention(item)).length;
    const resolvedPrevMonth = prevMonthInterventions.filter((item) => this.isResolvedIntervention(item)).length;

    const userActivity = this.buildUserActivity(
      monthRooms,
      monthEquipment,
      monthInterventions,
      roleView
    );

    return {
      rooms: monthRooms.length,
      roomsPrev: prevMonthRooms.length,
      equipment: monthEquipment.length,
      equipmentPrev: prevMonthEquipment.length,
      interventions: monthInterventions.length,
      interventionsPrev: prevMonthInterventions.length,
      resolution: monthInterventions.length > 0 ? Math.round((resolvedThisMonth / monthInterventions.length) * 100) : 0,
      resolutionPrev: prevMonthInterventions.length > 0 ? Math.round((resolvedPrevMonth / prevMonthInterventions.length) * 100) : 0,
      documents: monthArchivedDocs.length,
      documentsPrev: prevMonthArchivedDocs.length,
      roomTop: this.buildTopList(
        monthRooms.map((item) => item.roomName),
        ROOM_COLORS,
        5
      ),
      interventionTop: this.buildTopList(
        monthInterventions.map((item) => this.mapInterventionType(item.type)),
        INTERVENTION_COLORS,
        5
      ),
      equipmentTop: this.buildTopList(
        monthEquipment.map((item) => item.equipmentName),
        EQUIPMENT_COLORS,
        5
      ),
      userTop: userActivity
    };
  }

  private getFallbackSnapshot(roleView: ReportRoleView): ReportSnapshot {
    if (roleView === 'employee') {
      return {
        rooms: 12,
        roomsPrev: 10,
        equipment: 8,
        equipmentPrev: 6,
        interventions: 4,
        interventionsPrev: 3,
        resolution: 75,
        resolutionPrev: 71,
        documents: 16,
        documentsPrev: 14,
        roomTop: this.buildFallbackRanked([
          ['Salle B2', 6],
          ['Salle C3', 4],
          ['Labo info', 3],
          ['Amphi', 2],
          ['Salle A1', 2]
        ], ROOM_COLORS),
        interventionTop: this.buildFallbackRanked([
          ['Informatique', 2],
          ['Maintenance', 1],
          ['Support', 1],
          ['Autre', 1]
        ], INTERVENTION_COLORS),
        equipmentTop: this.buildFallbackRanked([
          ['Laptop Dell', 5],
          ['Projecteur HD', 4],
          ['Camera Sony', 3],
          ['Micro HF', 2],
          ['Tablette iPad', 2]
        ], EQUIPMENT_COLORS),
        userTop: this.buildFallbackUsers([
          ['Employe Standard', 18],
          ['Sami K.', 11],
          ['Amine T.', 9],
          ['Nadia M.', 7]
        ])
      };
    }

    if (roleView === 'managerResponsible') {
      return {
        rooms: 29,
        roomsPrev: 25,
        equipment: 18,
        equipmentPrev: 15,
        interventions: 11,
        interventionsPrev: 9,
        resolution: 81,
        resolutionPrev: 76,
        documents: 34,
        documentsPrev: 30,
        roomTop: this.buildFallbackRanked([
          ['Salle A1', 11],
          ['Salle B2', 9],
          ['Salle C3', 6],
          ['Amphi', 4],
          ['Labo info', 3]
        ], ROOM_COLORS),
        interventionTop: this.buildFallbackRanked([
          ['Informatique', 5],
          ['Electricite', 3],
          ['Climatisation', 2],
          ['Plomberie', 1],
          ['Autre', 1]
        ], INTERVENTION_COLORS),
        equipmentTop: this.buildFallbackRanked([
          ['Projecteur HD', 7],
          ['Laptop Dell', 5],
          ['Camera Sony', 4],
          ['Tablette iPad', 3],
          ['Micro HF', 2]
        ], EQUIPMENT_COLORS),
        userTop: this.buildFallbackUsers([
          ['Wassim B.', 30],
          ['Nadia M.', 24],
          ['Amine T.', 19],
          ['Sami K.', 16]
        ])
      };
    }

    return {
      rooms: 47,
      roomsPrev: 42,
      equipment: 31,
      equipmentPrev: 26,
      interventions: 18,
      interventionsPrev: 15,
      resolution: 83,
      resolutionPrev: 79,
      documents: 54,
      documentsPrev: 46,
      roomTop: this.buildFallbackRanked([
        ['Salle A1', 14],
        ['Salle B2', 11],
        ['Salle C3', 8],
        ['Amphi', 6],
        ['Labo info', 4]
      ], ROOM_COLORS),
      interventionTop: this.buildFallbackRanked([
        ['Informatique', 7],
        ['Electricite', 5],
        ['Climatisation', 3],
        ['Plomberie', 2],
        ['Autre', 1]
      ], INTERVENTION_COLORS),
      equipmentTop: this.buildFallbackRanked([
        ['Projecteur HD', 9],
        ['Laptop Dell', 7],
        ['Camera Sony', 5],
        ['Tablette iPad', 4],
        ['Micro HF', 3]
      ], EQUIPMENT_COLORS),
      userTop: this.buildFallbackUsers([
        ['Wassim B.', 42],
        ['Nadia M.', 38],
        ['Amine T.', 31],
        ['Sami K.', 27]
      ])
    };
  }

  private mergeSnapshot(live: ReportSnapshot, fallback: ReportSnapshot): ReportSnapshot {
    return {
      rooms: this.resolveMetric(live.rooms, fallback.rooms),
      roomsPrev: this.resolveMetric(live.roomsPrev, fallback.roomsPrev),
      equipment: this.resolveMetric(live.equipment, fallback.equipment),
      equipmentPrev: this.resolveMetric(live.equipmentPrev, fallback.equipmentPrev),
      interventions: this.resolveMetric(live.interventions, fallback.interventions),
      interventionsPrev: this.resolveMetric(live.interventionsPrev, fallback.interventionsPrev),
      resolution: this.resolveMetric(live.resolution, fallback.resolution),
      resolutionPrev: this.resolveMetric(live.resolutionPrev, fallback.resolutionPrev),
      documents: this.resolveMetric(live.documents, fallback.documents),
      documentsPrev: this.resolveMetric(live.documentsPrev, fallback.documentsPrev),
      roomTop: this.mergeRankedLists(live.roomTop, fallback.roomTop, 5),
      interventionTop: this.mergeRankedLists(live.interventionTop, fallback.interventionTop, 5),
      equipmentTop: this.mergeRankedLists(live.equipmentTop, fallback.equipmentTop, 5),
      userTop: this.mergeUserLists(live.userTop, fallback.userTop, 4)
    };
  }

  private buildKpiCards(snapshot: ReportSnapshot): KpiCard[] {
    const previousMonthName = this.getPreviousMonthName(this.selectedMonthKey);
    const roomPercentDelta = this.getPercentDelta(snapshot.rooms, snapshot.roomsPrev);
    const equipmentPercentDelta = this.getPercentDelta(snapshot.equipment, snapshot.equipmentPrev);
    const interventionDelta = snapshot.interventions - snapshot.interventionsPrev;
    const resolutionDelta = snapshot.resolution - snapshot.resolutionPrev;
    const documentsDelta = snapshot.documents - snapshot.documentsPrev;

    return [
      {
        key: 'rooms',
        label: 'Reservations salles',
        value: snapshot.rooms,
        deltaLabel: `${this.formatSigned(roomPercentDelta)}% vs ${previousMonthName}`,
        deltaTone: roomPercentDelta >= 0 ? 'positive' : 'negative'
      },
      {
        key: 'equipment',
        label: 'Reservations equipement',
        value: snapshot.equipment,
        deltaLabel: `${this.formatSigned(equipmentPercentDelta)}% vs ${previousMonthName}`,
        deltaTone: equipmentPercentDelta >= 0 ? 'positive' : 'negative'
      },
      {
        key: 'interventions',
        label: 'Interventions creees',
        value: snapshot.interventions,
        deltaLabel: `${this.formatSigned(interventionDelta)} vs ${previousMonthName}`,
        deltaTone: interventionDelta > 0 ? 'negative' : 'positive'
      },
      {
        key: 'resolution',
        label: 'Taux resolution',
        value: `${snapshot.resolution}%`,
        deltaLabel: `${this.formatSigned(resolutionDelta)}pts vs ${previousMonthName}`,
        deltaTone: resolutionDelta >= 0 ? 'positive' : 'negative'
      },
      {
        key: 'documents',
        label: 'Documents archives',
        value: snapshot.documents,
        deltaLabel: `${this.formatSigned(documentsDelta)} vs ${previousMonthName}`,
        deltaTone: documentsDelta >= 0 ? 'positive' : 'negative'
      }
    ];
  }

  private scopeRoomReservations(roleView: ReportRoleView): RoomReservation[] {
    if (roleView !== 'employee') {
      return this.roomReservations;
    }

    return this.roomReservations.filter((reservation) =>
      this.matchesCurrentUser(reservation.userId, '', reservation.userName)
    );
  }

  private scopeEquipmentReservations(roleView: ReportRoleView): EquipmentReservation[] {
    if (roleView !== 'employee') {
      return this.equipmentReservations;
    }

    return this.equipmentReservations.filter((reservation) =>
      this.matchesCurrentUser(reservation.userId, '', reservation.userName)
    );
  }

  private scopeInterventions(roleView: ReportRoleView): Intervention[] {
    if (roleView !== 'employee') {
      return this.interventions;
    }

    return this.interventions.filter((intervention) =>
      this.matchesCurrentUser(
        intervention.requesterId,
        intervention.requesterEmail,
        intervention.requesterName
      )
    );
  }

  private scopeDocuments(roleView: ReportRoleView): GedDocument[] {
    if (roleView === 'admin') {
      return this.documents;
    }

    if (roleView === 'employee') {
      return this.documents.filter((document) =>
        document.accessControl.roles.includes(UserRole.USER)
      );
    }

    if (roleView === 'managerResponsible') {
      return this.documents.filter((document) =>
        document.accessControl.roles.includes(UserRole.MANAGER) ||
        document.accessControl.roles.includes(UserRole.ADMIN)
      );
    }

    return [];
  }

  private buildTopList(values: string[], colorClasses: string[], limit: number): RankedStat[] {
    const counts = new Map<string, number>();

    values.forEach((value) => {
      const key = value.trim();
      if (!key) {
        return;
      }

      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, limit)
      .map(([label, value], index) => ({
        label,
        value,
        colorClass: colorClasses[index % colorClasses.length]
      }));
  }

  private buildUserActivity(
    roomReservations: RoomReservation[],
    equipmentReservations: EquipmentReservation[],
    interventions: Intervention[],
    roleView: ReportRoleView
  ): UserActivityStat[] {
    const userCounts = new Map<string, number>();

    roomReservations.forEach((reservation) => {
      this.incrementCounter(userCounts, reservation.userName);
    });

    equipmentReservations.forEach((reservation) => {
      this.incrementCounter(userCounts, reservation.userName);
    });

    interventions.forEach((intervention) => {
      this.incrementCounter(userCounts, intervention.requesterName);
    });

    if (userCounts.size === 0 && roleView === 'employee') {
      const current = this.authService.currentUser;
      if (current) {
        const currentName = `${current.firstName} ${current.lastName}`.trim();
        userCounts.set(currentName || 'Mon activite', 1);
      }
    }

    return Array.from(userCounts.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 4)
      .map(([name, actions], index) => ({
        name,
        actions,
        initials: this.getInitials(name),
        avatarClass: USER_AVATAR_CLASSES[index % USER_AVATAR_CLASSES.length],
        badgeClass: USER_BADGE_CLASSES[index % USER_BADGE_CLASSES.length]
      }));
  }

  private mapInterventionType(type: Intervention['type']): string {
    if (type === 'SUPPORT') {
      return 'Informatique';
    }
    if (type === 'MAINTENANCE') {
      return 'Maintenance';
    }
    if (type === 'REPAIR') {
      return 'Reparation';
    }
    if (type === 'INSTALLATION') {
      return 'Installation';
    }
    return 'Autre';
  }

  private isArchivedDocument(document: GedDocument): boolean {
    return (
      document.isArchived ||
      document.gedStatus === 'Archive' ||
      document.gedStatus === 'Obsolete'
    );
  }

  private isResolvedIntervention(intervention: Intervention): boolean {
    return (
      intervention.status === InterventionStatus.RESOLVED ||
      intervention.status === InterventionStatus.CLOSED
    );
  }

  private mergeRankedLists(live: RankedStat[], fallback: RankedStat[], limit: number): RankedStat[] {
    if (live.length === 0) {
      return fallback.slice(0, limit);
    }

    const result: RankedStat[] = [];
    const seen = new Set<string>();

    live.forEach((item) => {
      if (!seen.has(item.label) && result.length < limit) {
        result.push(item);
        seen.add(item.label);
      }
    });

    fallback.forEach((item) => {
      if (!seen.has(item.label) && result.length < limit) {
        result.push(item);
        seen.add(item.label);
      }
    });

    return result;
  }

  private mergeUserLists(live: UserActivityStat[], fallback: UserActivityStat[], limit: number): UserActivityStat[] {
    if (live.length === 0) {
      return fallback.slice(0, limit);
    }

    const result: UserActivityStat[] = [];
    const seen = new Set<string>();

    live.forEach((item) => {
      if (!seen.has(item.name) && result.length < limit) {
        result.push(item);
        seen.add(item.name);
      }
    });

    fallback.forEach((item) => {
      if (!seen.has(item.name) && result.length < limit) {
        result.push(item);
        seen.add(item.name);
      }
    });

    return result;
  }

  private buildFallbackRanked(items: Array<[string, number]>, colorClasses: string[]): RankedStat[] {
    return items.map(([label, value], index) => ({
      label,
      value,
      colorClass: colorClasses[index % colorClasses.length]
    }));
  }

  private buildFallbackUsers(items: Array<[string, number]>): UserActivityStat[] {
    return items.map(([name, actions], index) => ({
      name,
      actions,
      initials: this.getInitials(name),
      avatarClass: USER_AVATAR_CLASSES[index % USER_AVATAR_CLASSES.length],
      badgeClass: USER_BADGE_CLASSES[index % USER_BADGE_CLASSES.length]
    }));
  }

  private resolveMetric(liveValue: number, fallbackValue: number): number {
    return liveValue > 0 ? liveValue : fallbackValue;
  }

  private getPercentDelta(current: number, previous: number): number {
    if (previous <= 0) {
      return current > 0 ? 100 : 0;
    }

    return Math.round(((current - previous) / previous) * 100);
  }

  private getPreviousMonthName(monthKey: string): string {
    const previousKey = this.getPreviousMonthKey(monthKey);
    return this.monthOptions.find((item) => item.key === previousKey)?.monthName ?? 'mois precedent';
  }

  private getPreviousMonthKey(monthKey: string): string {
    const [year, month] = monthKey.split('-').map((value) => Number(value));
    if (Number.isNaN(year) || Number.isNaN(month)) {
      return monthKey;
    }

    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private inMonth(dateValue: Date, monthKey: string): boolean {
    const date = new Date(dateValue);
    const [year, month] = monthKey.split('-').map((value) => Number(value));

    if (Number.isNaN(year) || Number.isNaN(month)) {
      return false;
    }

    return date.getFullYear() === year && date.getMonth() === month - 1;
  }

  private incrementCounter(counter: Map<string, number>, key: string): void {
    const normalized = key.trim();
    if (!normalized) {
      return;
    }
    counter.set(normalized, (counter.get(normalized) ?? 0) + 1);
  }

  private getInitials(name: string): string {
    const parts = name
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .slice(0, 2);

    if (parts.length === 0) {
      return 'NA';
    }

    return parts.map((part) => part[0].toUpperCase()).join('');
  }

  private matchesCurrentUser(targetUserId?: string, targetEmail?: string, targetName?: string): boolean {
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

  private formatSigned(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }

  private getMaxValue(items: RankedStat[]): number {
    if (items.length === 0) {
      return 0;
    }

    return Math.max(...items.map((item) => item.value));
  }

  private getCardValue(key: KpiCard['key']): string | number {
    return this.kpiCards.find((card) => card.key === key)?.value ?? '-';
  }

  private getCardDelta(key: KpiCard['key']): string {
    return this.kpiCards.find((card) => card.key === key)?.deltaLabel ?? '-';
  }

  private getPreviousMetricValue(key: KpiCard['key']): string | number {
    if (key === 'rooms') {
      return this.findMetricByKey('roomsPrev');
    }
    if (key === 'equipment') {
      return this.findMetricByKey('equipmentPrev');
    }
    if (key === 'interventions') {
      return this.findMetricByKey('interventionsPrev');
    }
    if (key === 'resolution') {
      const value = this.findMetricByKey('resolutionPrev');
      return `${value}%`;
    }

    return this.findMetricByKey('documentsPrev');
  }

  private findMetricByKey(key: 'roomsPrev' | 'equipmentPrev' | 'interventionsPrev' | 'resolutionPrev' | 'documentsPrev'): number {
    const roleView = this.getRoleView();
    const liveSnapshot = this.buildLiveSnapshot(roleView);
    const fallbackSnapshot = this.getFallbackSnapshot(roleView);
    const mergedSnapshot = this.mergeSnapshot(liveSnapshot, fallbackSnapshot);
    return mergedSnapshot[key];
  }

  private escapeCsv(value: string | number): string {
    const raw = String(value ?? '');
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }

}
