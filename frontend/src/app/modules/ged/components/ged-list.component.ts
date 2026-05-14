import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { AppRole, Document, DocumentVersion } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import {
  DocumentService,
  GedAclRole,
  GedAuditLogEntry,
  GedConfidentialityLevel,
  GedDocumentLink,
  GedFolderTreeNode,
  GedPreviewPayload,
} from '../../../core/services/document.service';
import { GedPreviewRenderMode, resolveGedPreviewRenderMode, supportsGedPrint } from '../utils/ged-preview.util';

type FeedbackTone = 'success' | 'error';
type RelationType = 'RELATED' | 'ANNEXE' | 'SOURCE' | 'REFERENCE';
type GedStatusFilter = Document['gedStatus'] | 'ALL';
type GedSortOption = 'updatedDesc' | 'updatedAsc' | 'titleAsc' | 'titleDesc' | 'referenceAsc' | 'referenceDesc';
type GedCategoryTabId = 'ALL' | 'PROCEDURES' | 'FORMULAIRES' | 'TECHNIQUES' | 'ARCHIVES';

interface GedStatusOption {
  value: GedStatusFilter;
  label: string;
}

interface GedCategoryTab {
  id: GedCategoryTabId;
  label: string;
}

interface GedTabItem {
  id: string;
  folderId: string | null;
  label: string;
  count: number;
}

interface FlatFolderNode {
  id: string;
  name: string;
  parentId: string | null;
  category: string | null;
  archived: boolean;
  documentCount: number;
  depth: number;
  breadcrumb: string;
}

interface VisibleFolderNode extends FlatFolderNode {
  displayDepth: number;
}

@Component({
  selector: 'app-ged-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ged-list.component.html',
  styles: [],
})
export class GedListComponent implements OnInit, OnDestroy {
  private readonly maxUploadSizeBytes = 10 * 1024 * 1024;
  private readonly allowedUploadExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt'];
  private readonly defaultDocumentServices = [
    'DSI',
    'QUALITE',
    'SECURITE',
    'DIRECTION',
    'ADMINISTRATION',
    'LOGISTIQUE',
    'RESSOURCES HUMAINES',
  ];

  readonly confidentialityOptions: GedConfidentialityLevel[] = [
    'PUBLIC',
    'INTERNAL',
    'RESTRICTED',
    'CONFIDENTIAL',
  ];

  readonly roleLabels: Record<AppRole, string> = {
    ADMIN: 'Administrateur',
    EMPLOYEE: 'Employe',
    MANAGER: 'Chef hierarchique',
    ROOM_MANAGER: 'Responsable salle',
    IT_MANAGER: 'Responsable IT',
    SECURITY_MANAGER: 'Responsable securite',
    DSN_DIRECTOR: 'Directeur DSN',
    QUALITY_MANAGER: 'Responsable qualite',
  };

  readonly aclRoleOptions: GedAclRole[] = [
    'ADMIN',
    'EMPLOYE',
    'CHEF_HIERARCHIQUE',
    'RESPONSABLE_SALLE',
    'RESPONSABLE_SECURITE',
    'DIRECTEUR_DSN',
    'RESPONSABLE_QUALITE',
  ];
  readonly mandatoryAclRoles: GedAclRole[] = ['ADMIN', 'RESPONSABLE_QUALITE'];

  readonly relationTypeOptions: RelationType[] = ['RELATED', 'ANNEXE', 'SOURCE', 'REFERENCE'];
  readonly statusOptions: GedStatusOption[] = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'Brouillon', label: 'Brouillon' },
    { value: 'En attente qualite', label: 'En attente qualite' },
    { value: 'Valide qualite', label: 'Valide qualite' },
    { value: 'Valide qualite (publiable)', label: 'Valide qualite (publiable)' },
    { value: 'Publie', label: 'Publie' },
    { value: 'Refuse', label: 'Refuse' },
    { value: 'Archive', label: 'Archive' },
    { value: 'Obsolete', label: 'Obsolete' },
  ];

  readonly categoryTabs: GedCategoryTab[] = [
    { id: 'ALL', label: 'Tous les documents' },
    { id: 'PROCEDURES', label: 'Procedures' },
    { id: 'FORMULAIRES', label: 'Formulaires' },
    { id: 'TECHNIQUES', label: 'Documents techniques' },
    { id: 'ARCHIVES', label: 'Archives' },
  ];

  currentRole: AppRole = 'EMPLOYEE';
  currentUserName = '';
  currentUserService = '';

  searchTerm = '';
  selectedStatus: GedStatusFilter = 'ALL';
  selectedCategory = 'ALL';
  selectedSortOption: GedSortOption = 'updatedDesc';
  selectedFolderId: string | null = null;
  activeTabFolderId: string | null = null;
  selectedConfidentiality: GedConfidentialityLevel | 'ALL' = 'ALL';
  activeCategoryTab: GedCategoryTabId = 'ALL';
  showAdvancedFilters = false;
  categoryOptions: string[] = [];
  tabs: GedTabItem[] = [];
  documents: Document[] = [];
  allDocuments: Document[] = [];
  selectedDocument: Document | null = null;
  visibleFolders: VisibleFolderNode[] = [];
  totalDocumentsCount = 0;
  pageSize = 12;
  currentPage = 1;
  openActionMenuDocumentId: string | null = null;

  folderTree: GedFolderTreeNode[] = [];
  flatFolders: FlatFolderNode[] = [];

  isLoadingFolders = false;
  isLoadingDocuments = false;
  isSavingFolder = false;
  isSavingDocument = false;
  isSavingVersion = false;
  isSavingAcl = false;
  isLoadingAcl = false;
  isLoadingPreview = false;
  isLoadingAuditLogs = false;
  isPrintingSelectedDocument = false;

  feedbackMessage = '';
  feedbackTone: FeedbackTone = 'success';

  showFolderModal = false;
  editingFolderId: string | null = null;
  folderName = '';
  folderCategory = '';
  folderParentId: string | null = null;
  showFolderDetailsModal = false;
  folderDetailsTarget: FlatFolderNode | null = null;

  showDocumentModal = false;
  editingDocument: Document | null = null;
  documentFolderId: string | null = null;
  documentTitle = '';
  documentCategory = '';
  documentSubCategory = '';
  documentDescription = '';
  documentUploadFile: File | null = null;
  documentConfidentiality: GedConfidentialityLevel = 'INTERNAL';
  documentAllowedRoles = '';
  documentAllowedServices = '';
  documentServiceOptions: string[] = [];

  showVersionModal = false;
  versionTarget: Document | null = null;
  versionUploadFile: File | null = null;
  versionChangeNote = '';

  showAclModal = false;
  aclTarget: Document | null = null;
  aclSelectedRoles: GedAclRole[] = [];
  aclSelectedServices: string[] = [];
  aclConfidentiality: GedConfidentialityLevel = 'INTERNAL';
  aclServiceOptions: string[] = [];
  aclServiceSearch = '';

  showPreviewModal = false;
  previewDocument: Document | null = null;
  previewData: GedPreviewPayload | null = null;
  previewVersions: DocumentVersion[] = [];
  previewVersionNumber: number | null = null;
  previewSearch = '';
  previewSearchMatches = 0;
  previewZoomPercent = 100;
  previewPageSize = 1200;
  previewPage = 1;
  previewTotalPages = 1;
  previewFullscreen = false;
  previewRenderMode: GedPreviewRenderMode = 'fallback';
  previewBlobUrl = '';
  previewPdfUrl: SafeResourceUrl | null = null;
  previewTextContent = '';
  previewFileName = '';
  previewMimeType = 'application/octet-stream';
  previewFileSize = 0;
  previewLinks: GedDocumentLink[] = [];
  selectedLinkedDocumentId = '';
  selectedRelationType: RelationType = 'RELATED';
  isPrintingPreview = false;

  showAuditPanel = false;
  auditLogs: GedAuditLogEntry[] = [];

  private readonly subscriptions = new Subscription();

  constructor(
    private documentService: DocumentService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user) => {
        if (!user) {
          return;
        }
        this.currentRole = user.role;
        this.currentUserName = `${user.firstName} ${user.lastName}`.trim();
        this.currentUserService = (user.department || '').trim();
        if (!this.documentAllowedServices) {
          this.documentAllowedServices = this.resolveDefaultDocumentService();
        }
      }),
    );

    this.loadDocumentServiceOptions();
    this.refreshGedData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.revokePreviewBlobUrl();
    this.setGedModalChromeHidden(false);
  }

  refreshGedData(): void {
    this.loadFolders();
    this.loadDocuments();
  }

  loadFolders(): void {
    this.isLoadingFolders = true;
    this.subscriptions.add(
      this.documentService.getFoldersTree().subscribe({
        next: (folders) => {
          this.isLoadingFolders = false;
          const previousSelectedFolderId = this.selectedFolderId;
          this.folderTree = Array.isArray(folders) ? folders : [];
          this.flatFolders = this.flattenFolders(this.folderTree);
          this.tabs = this.buildTabs(this.folderTree);
          this.ensureActiveTab();
          if (!this.selectedFolderId || !this.flatFolders.some((node) => node.id === this.selectedFolderId)) {
            this.selectedFolderId = this.resolvePreferredFolderId();
          }
          this.refreshVisibleFolders();
          if (this.selectedFolderId && this.selectedFolderId !== previousSelectedFolderId) {
            this.loadDocuments(true);
          }
        },
        error: (error: unknown) => {
          this.isLoadingFolders = false;
          this.setFeedback(this.toErrorMessage(error, 'Chargement des dossiers impossible.'), 'error');
        },
      }),
    );
  }

  loadDocuments(resetPage = false): void {
    if (resetPage) {
      this.currentPage = 1;
    }
    this.isLoadingDocuments = true;
    this.subscriptions.add(
      this.documentService.getDocuments({
        search: this.searchTerm.trim() || undefined,
        folderId: this.selectedFolderId ?? undefined,
        category: this.selectedCategory === 'ALL' ? undefined : this.selectedCategory,
        confidentiality: this.selectedConfidentiality === 'ALL' ? undefined : this.selectedConfidentiality,
        page: 0,
        size: 300,
      }).subscribe({
        next: (documents) => {
          this.isLoadingDocuments = false;
          this.allDocuments = Array.isArray(documents) ? documents : [];
          this.documentServiceOptions = this.uniqueSortedValues([
            ...this.defaultDocumentServices,
            ...this.documentServiceOptions,
            ...this.collectGedOwnerServices(),
            this.currentUserService,
          ].filter((service) => !!service));
          this.refreshCategoryOptions();
          this.applyDocumentPresentation();
        },
        error: (error: unknown) => {
          this.isLoadingDocuments = false;
          this.setFeedback(this.toErrorMessage(error, 'Chargement des documents impossible.'), 'error');
        },
      }),
    );
  }

  onSelectFolder(folderId: string): void {
    this.selectedFolderId = folderId;
    this.openActionMenuDocumentId = null;
    this.currentPage = 1;
    this.loadDocuments();
  }

  onSelectDocument(document: Document): void {
    this.selectedDocument = document;
  }

  applySearch(): void {
    this.loadDocuments(true);
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'ALL';
    this.selectedCategory = 'ALL';
    this.selectedSortOption = 'updatedDesc';
    this.selectedConfidentiality = 'ALL';
    this.activeCategoryTab = 'ALL';
    this.loadDocuments(true);
  }

  onSelectCategoryTab(tabId: GedCategoryTabId): void {
    if (this.activeCategoryTab === tabId) {
      return;
    }
    this.activeCategoryTab = tabId;
    this.applyDocumentPresentation(true);
  }

  categoryTabCount(tabId: GedCategoryTabId): number {
    return this.allDocuments.filter((document) => this.matchesCategoryTab(document, tabId)).length;
  }

  isCategoryTabActive(tabId: GedCategoryTabId): boolean {
    return this.activeCategoryTab === tabId;
  }

  onSelectTab(folderId: string | null): void {
    this.activeTabFolderId = folderId;
    this.openActionMenuDocumentId = null;
    this.refreshVisibleFolders();
    this.selectedFolderId = folderId || this.flatFolders[0]?.id || null;
    this.loadDocuments(true);
  }

  onStatusChange(): void {
    this.applyDocumentPresentation(true);
  }

  onSortChange(): void {
    this.applyDocumentPresentation(true);
  }

  onCategoryChange(): void {
    this.loadDocuments(true);
  }

  trackByFolderId(_index: number, folder: VisibleFolderNode): string {
    return folder.id;
  }

  trackByDocumentId(_index: number, document: Document): string {
    return document.id;
  }

  isActionMenuOpen(documentId: string): boolean {
    return this.openActionMenuDocumentId === documentId;
  }

  toggleActionMenu(documentId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.openActionMenuDocumentId = this.openActionMenuDocumentId === documentId ? null : documentId;
  }

  closeActionMenu(): void {
    this.openActionMenuDocumentId = null;
  }

  onMenuContainerClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  openPreviewFromAction(document: Document): void {
    this.closeActionMenu();
    this.openPreview(document);
  }

  openAnnexesFromAction(document: Document): void {
    this.closeActionMenu();
    this.openPreview(document);
  }

  openVersionsFromAction(document: Document): void {
    this.closeActionMenu();
    if (this.canManageGed()) {
      this.openVersionModal(document);
      return;
    }
    this.openPreview(document);
  }

  openAclFromAction(document: Document): void {
    this.closeActionMenu();
    this.openAclModal(document);
  }

  openEditFromAction(document: Document): void {
    this.closeActionMenu();
    this.openEditDocument(document);
  }

  downloadDocument(targetDocument: Document): void {
    this.closeActionMenu();
    this.subscriptions.add(
      this.documentService.downloadDocumentBinary(targetDocument.id).subscribe({
        next: ({ content, fileName }) => {
          this.triggerFileDownload(content, fileName || `${targetDocument.referenceCode || targetDocument.title}.txt`);
          this.setFeedback('Document telecharge avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Telechargement impossible.'), 'error');
        },
      }),
    );
  }

  totalDocumentCount(): number {
    if (this.folderTree.length === 0) {
      return this.totalDocumentsCount;
    }
    if (this.folderTree.length === 1) {
      return this.folderTree[0].documentCount;
    }
    return this.folderTree.reduce((sum, node) => sum + node.documentCount, 0);
  }

  currentRangeStart(): number {
    if (this.totalDocumentsCount === 0) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  currentRangeEnd(): number {
    if (this.totalDocumentsCount === 0) {
      return 0;
    }
    return Math.min(this.currentPage * this.pageSize, this.totalDocumentsCount);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalDocumentsCount / this.pageSize));
  }

  canGoToPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  canGoToNextPage(): boolean {
    return this.currentPage < this.totalPages();
  }

  previousPage(): void {
    if (!this.canGoToPreviousPage()) {
      return;
    }
    this.currentPage -= 1;
    this.applyDocumentPresentation();
  }

  nextPage(): void {
    if (!this.canGoToNextPage()) {
      return;
    }
    this.currentPage += 1;
    this.applyDocumentPresentation();
  }

  goToPage(page: number): void {
    const boundedPage = Math.max(1, Math.min(page, this.totalPages()));
    if (boundedPage === this.currentPage) {
      return;
    }
    this.currentPage = boundedPage;
    this.applyDocumentPresentation();
  }

  paginationPages(): number[] {
    const totalPages = this.totalPages();
    const start = Math.max(1, this.currentPage - 1);
    const end = Math.min(totalPages, start + 2);
    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  getCategoryBadgeClass(category: string | undefined): string {
    if (!category) {
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
    const normalized = category.toLowerCase();
    if (normalized.includes('procedure')) {
      return 'bg-brand-500/10 text-brand-700 dark:text-brand-300';
    }
    if (normalized.includes('formulaire')) {
      return 'bg-info-500/10 text-info-700 dark:text-info-300';
    }
    if (normalized.includes('technique')) {
      return 'bg-warning-500/10 text-warning-700 dark:text-warning-300';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }

  getTabAccentClass(tab: GedTabItem): string {
    const normalized = this.normalizeText(tab.label).toLowerCase();
    if (normalized.includes('ged')) {
      return 'bg-brand-500';
    }
    if (normalized.includes('formulaire')) {
      return 'bg-info-500';
    }
    if (normalized.includes('technique')) {
      return 'bg-warning-500';
    }
    return 'bg-gray-400';
  }

  getTabDescription(tab: GedTabItem): string {
    const normalized = this.normalizeText(tab.label).toLowerCase();
    if (normalized.includes('ged')) {
      return 'Espace principal de gestion documentaire et conformité qualité.';
    }
    if (normalized.includes('formulaire')) {
      return 'Procédures qualité et formulaires opérationnels disponibles.';
    }
    if (normalized.includes('technique')) {
      return 'Référentiels techniques, modes opératoires et guides spécialisés.';
    }
    return `Navigation documentaire (${tab.count} document${tab.count > 1 ? 's' : ''}).`;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeActionMenu();
  }

  canManageGed(): boolean {
    return this.authService.hasRole('ADMIN', 'QUALITY_MANAGER');
  }

  canPublish(): boolean {
    return this.authService.hasPermission('PUBLISH_DOCUMENT');
  }

  canViewAuditLogs(): boolean {
    return this.canManageGed();
  }

  canCreateDocumentFromSelection(): boolean {
    return !!this.selectedFolderId;
  }

  selectedFolderCreationHint(): string {
    if (this.selectedFolderId) {
      return 'Le nouveau dossier sera cree sous le dossier selectionne.';
    }
    return 'Selectionnez un dossier dans l arborescence pour creer un sous-dossier.';
  }

  openCreateSubFolder(): void {
    if (!this.selectedFolderId) {
      this.setFeedback('Selectionnez un dossier dans l arborescence avant creation du sous-dossier.', 'error');
      return;
    }
    this.openCreateFolder(this.selectedFolderId);
  }

  openCreateGedSubFolder(): void {
    const rootFolder = this.gedRootFolder();
    if (!rootFolder) {
      this.setFeedback('Le dossier GED principal est introuvable.', 'error');
      return;
    }
    this.selectedFolderId = rootFolder.id;
    this.openCreateFolder(rootFolder.id);
  }

  selectDocumentAndOpenPreview(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour le consulter.', 'error');
      return;
    }
    this.openPreview(this.selectedDocument);
  }

  selectDocumentAndDownload(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour le telecharger.', 'error');
      return;
    }
    this.downloadDocument(this.selectedDocument);
  }

  selectDocumentAndOpenAnnexes(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour consulter ses annexes.', 'error');
      return;
    }
    this.openPreview(this.selectedDocument);
  }

  selectDocumentAndOpenAcl(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour gerer les acces.', 'error');
      return;
    }
    if (!this.canManageGed()) {
      this.setFeedback('Action reservee a l administrateur ou au responsable qualite.', 'error');
      return;
    }
    this.openAclModal(this.selectedDocument);
  }

  selectDocumentAndOpenVersions(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour gerer les versions.', 'error');
      return;
    }
    if (!this.canManageGed()) {
      this.setFeedback('Action reservee a l administrateur ou au responsable qualite.', 'error');
      return;
    }
    this.openVersionModal(this.selectedDocument);
  }

  selectDocumentAndEdit(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour le modifier.', 'error');
      return;
    }
    if (!this.canManageGed()) {
      this.setFeedback('Action reservee a l administrateur ou au responsable qualite.', 'error');
      return;
    }
    this.openEditDocument(this.selectedDocument);
  }

  selectDocumentAndArchive(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour l archiver.', 'error');
      return;
    }
    if (!this.canManageGed()) {
      this.setFeedback('Action reservee a l administrateur ou au responsable qualite.', 'error');
      return;
    }
    this.archiveDocument(this.selectedDocument);
  }

  selectDocumentAndDelete(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour le supprimer.', 'error');
      return;
    }
    if (!this.canManageGed()) {
      this.setFeedback('Action reservee a l administrateur ou au responsable qualite.', 'error');
      return;
    }
    this.deleteDocumentPermanently(this.selectedDocument);
  }

  selectDocumentAndSubmit(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour le soumettre.', 'error');
      return;
    }
    if (!this.canSubmit(this.selectedDocument)) {
      this.setFeedback('Ce document ne peut pas etre soumis dans son statut actuel.', 'error');
      return;
    }
    this.submitDocument(this.selectedDocument);
  }

  selectDocumentAndApprove(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour le valider.', 'error');
      return;
    }
    if (!this.canApprove(this.selectedDocument)) {
      this.setFeedback('Validation indisponible pour ce document.', 'error');
      return;
    }
    this.approveDocument(this.selectedDocument);
  }

  selectDocumentAndPublish(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour le publier.', 'error');
      return;
    }
    if (!this.canPublishDocument(this.selectedDocument)) {
      this.setFeedback('Publication indisponible pour ce document.', 'error');
      return;
    }
    this.publishDocument(this.selectedDocument);
  }

  printSelectedDocument(): void {
    if (!this.selectedDocument) {
      this.setFeedback('Selectionnez un document pour l imprimer.', 'error');
      return;
    }

    this.isPrintingSelectedDocument = true;
    const targetDocument = this.selectedDocument;
    this.subscriptions.add(
      this.documentService.previewDocument(targetDocument.id, { page: 1, pageSize: 1200 }).subscribe({
        next: (previewPayload) => {
          this.subscriptions.add(
            this.documentService.auditDocumentPrint(targetDocument.id, previewPayload.versionNumber).subscribe({
              next: () => {
                this.subscriptions.add(
                  this.documentService.downloadDocumentBinary(targetDocument.id, previewPayload.versionNumber).subscribe({
                    next: ({ content }) => {
                      this.isPrintingSelectedDocument = false;
                      this.printBinaryDocument(content);
                      this.setFeedback('Impression envoyee.', 'success');
                    },
                    error: (error: unknown) => {
                      this.isPrintingSelectedDocument = false;
                      this.setFeedback(this.toErrorMessage(error, 'Impression impossible.'), 'error');
                    },
                  }),
                );
              },
              error: (error: unknown) => {
                this.isPrintingSelectedDocument = false;
                this.setFeedback(this.toErrorMessage(error, 'Impression impossible.'), 'error');
              },
            }),
          );
        },
        error: (error: unknown) => {
          this.isPrintingSelectedDocument = false;
          this.setFeedback(this.toErrorMessage(error, 'Impression impossible.'), 'error');
        },
      }),
    );
  }

  openCreateFolder(parentId: string | null = null): void {
    this.editingFolderId = null;
    this.folderParentId = parentId;
    this.folderName = '';
    this.folderCategory = '';
    this.showFolderModal = true;
    this.syncGedModalChromeVisibility();
    this.clearFeedback();
  }

  openEditFolder(node: FlatFolderNode): void {
    this.editingFolderId = node.id;
    this.folderParentId = node.parentId;
    this.folderName = node.name;
    this.folderCategory = node.category || '';
    this.showFolderModal = true;
    this.syncGedModalChromeVisibility();
    this.clearFeedback();
  }

  closeFolderModal(): void {
    this.showFolderModal = false;
    this.editingFolderId = null;
    this.folderName = '';
    this.folderCategory = '';
    this.folderParentId = null;
    this.syncGedModalChromeVisibility();
  }

  openFolderDetails(node: FlatFolderNode): void {
    this.folderDetailsTarget = node;
    this.showFolderDetailsModal = true;
    this.syncGedModalChromeVisibility();
    this.clearFeedback();
  }

  closeFolderDetailsModal(): void {
    this.showFolderDetailsModal = false;
    this.folderDetailsTarget = null;
    this.syncGedModalChromeVisibility();
  }

  saveFolder(): void {
    const name = this.folderName.trim();
    if (!name) {
      this.setFeedback('Le nom du dossier est obligatoire.', 'error');
      return;
    }

    this.isSavingFolder = true;
    const request = {
      name,
      parentId: this.folderParentId,
      category: this.folderCategory.trim() || null,
    };

    const request$ = this.editingFolderId
      ? this.documentService.updateFolder(this.editingFolderId, request)
      : this.documentService.createFolder(request);

    this.subscriptions.add(
      request$.subscribe({
        next: () => {
          this.isSavingFolder = false;
          this.closeFolderModal();
          this.loadFolders();
          this.loadDocuments();
          this.setFeedback('Dossier enregistre avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.isSavingFolder = false;
          this.setFeedback(this.toErrorMessage(error, 'Enregistrement du dossier impossible.'), 'error');
        },
      }),
    );
  }

  archiveFolder(node: FlatFolderNode): void {
    const linkedDocuments = this.countDocumentsInFolderTree(node.id);
    const archiveMessage = linkedDocuments > 0
      ? `Le dossier "${node.breadcrumb}" contient ${linkedDocuments} document(s). L action va archiver le dossier et ses documents sans suppression physique. Continuer ?`
      : `Archiver le dossier "${node.breadcrumb}" ?`;

    if (!confirm(archiveMessage)) {
      return;
    }

    this.subscriptions.add(
      this.documentService.archiveFolder(node.id).subscribe({
        next: () => {
          this.loadFolders();
          this.loadDocuments();
          this.setFeedback(linkedDocuments > 0
            ? 'Dossier archive. Les documents relies restent conserves en mode archive.'
            : 'Dossier archive avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Archivage du dossier impossible.'), 'error');
        },
      }),
    );
  }

  openCreateDocument(): void {
    if (!this.selectedFolderId) {
      this.setFeedback('Selectionnez un dossier avant creation du document.', 'error');
      return;
    }

    this.editingDocument = null;
    this.documentFolderId = this.selectedFolderId;
    this.documentTitle = '';
    this.documentCategory = '';
    this.documentSubCategory = '';
    this.documentDescription = '';
    this.documentUploadFile = null;
    this.documentConfidentiality = 'INTERNAL';
    this.documentAllowedRoles = '';
    this.documentAllowedServices = this.resolveDefaultDocumentService();
    this.showDocumentModal = true;
    this.syncGedModalChromeVisibility();
    this.clearFeedback();
  }

  openEditDocument(document: Document): void {
    this.editingDocument = document;
    this.documentFolderId = document.folderId || this.selectedFolderId;
    this.documentTitle = document.title;
    this.documentCategory = document.category?.name || '';
    this.documentSubCategory = document.subCategory || '';
    this.documentDescription = document.description || '';
    this.documentUploadFile = null;
    this.documentConfidentiality = document.confidentialityLevel || 'INTERNAL';
    this.documentAllowedRoles = '';
    this.documentAllowedServices = document.ownerService || this.resolveDefaultDocumentService();
    this.showDocumentModal = true;
    this.syncGedModalChromeVisibility();
    this.clearFeedback();
  }

  closeDocumentModal(): void {
    this.showDocumentModal = false;
    this.editingDocument = null;
    this.documentUploadFile = null;
    this.syncGedModalChromeVisibility();
  }

  onDocumentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.documentUploadFile = null;
      return;
    }
    const validationError = this.validateUploadFile(file);
    if (validationError) {
      this.documentUploadFile = null;
      input.value = '';
      this.setFeedback(validationError, 'error');
      return;
    }
    this.documentUploadFile = file;
  }

  removeDocumentFile(): void {
    this.documentUploadFile = null;
  }

  private loadDocumentServiceOptions(): void {
    this.subscriptions.add(
      this.authService.getPublicDepartments().subscribe((departments) => {
        const services = departments
          .map((department) => this.normalizeText(department.name || department.code))
          .filter((service) => !!service);
        this.documentServiceOptions = this.uniqueSortedValues([
          ...this.defaultDocumentServices,
          ...services,
          ...this.collectGedOwnerServices(),
          this.currentUserService,
        ].filter((service) => !!service));
        if (!this.documentAllowedServices) {
          this.documentAllowedServices = this.resolveDefaultDocumentService();
        }
      }),
    );
  }

  private collectGedOwnerServices(): string[] {
    return this.allDocuments
      .map((document) => this.normalizeText(document.ownerService))
      .filter((service) => !!service);
  }

  private resolveDefaultDocumentService(): string {
    const currentService = this.normalizeText(this.currentUserService);
    if (currentService) {
      return currentService;
    }
    return this.documentServiceOptions[0] || '';
  }

  private resolveDocumentCategory(folderId: string | null): string {
    const folder = this.flatFolders.find((item) => item.id === folderId);
    return this.normalizeText(folder?.category)
      || this.normalizeText(folder?.name)
      || this.normalizeText(this.editingDocument?.category?.name)
      || 'General';
  }

  saveDocument(): void {
    const folderId = this.documentFolderId;
    const title = this.documentTitle.trim();
    const category = this.resolveDocumentCategory(folderId);
    const selectedService = this.documentAllowedServices.trim();

    if (!folderId) {
      this.setFeedback('Le dossier est obligatoire.', 'error');
      return;
    }
    if (!title) {
      this.setFeedback('Le titre est obligatoire.', 'error');
      return;
    }
    if (!selectedService) {
      this.setFeedback('Le service est obligatoire.', 'error');
      return;
    }

    this.isSavingDocument = true;

    if (this.editingDocument) {
      this.subscriptions.add(
        this.documentService.updateDocumentMetadata(this.editingDocument.id, {
          folderId,
          title,
          category,
          subCategory: undefined,
          description: this.documentDescription.trim() || undefined,
          confidentialityLevel: this.documentConfidentiality,
        }).subscribe({
          next: () => {
            this.isSavingDocument = false;
            this.closeDocumentModal();
            this.loadDocuments();
            this.setFeedback('Document modifie avec succes.', 'success');
          },
          error: (error: unknown) => {
            this.isSavingDocument = false;
            this.setFeedback(this.toErrorMessage(error, 'Modification du document impossible.'), 'error');
          },
        }),
      );
      return;
    }

    if (!this.documentUploadFile) {
      this.isSavingDocument = false;
      this.setFeedback('Le fichier est obligatoire pour creer un document GED.', 'error');
      return;
    }
    if (this.documentUploadFile.size <= 0) {
      this.isSavingDocument = false;
      this.setFeedback('Le fichier selectionne est vide.', 'error');
      return;
    }

    this.subscriptions.add(
      this.documentService.createDocumentWithUpload({
        folderId,
        title,
        category,
        subCategory: undefined,
        description: this.documentDescription.trim() || undefined,
        confidentialityLevel: this.documentConfidentiality,
        allowedRoles: [],
        allowedServices: [selectedService],
      }, this.documentUploadFile).subscribe({
        next: () => {
          this.isSavingDocument = false;
          this.closeDocumentModal();
          this.loadDocuments();
          this.setFeedback('Document cree avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.isSavingDocument = false;
          this.setFeedback(this.toErrorMessage(error, 'Creation du document impossible.'), 'error');
        },
      }),
    );
  }

  submitDocument(document: Document): void {
    this.closeActionMenu();
    this.subscriptions.add(
      this.documentService.submitWorkflow(document.id).subscribe({
        next: () => {
          this.loadDocuments();
          this.setFeedback('Document soumis au workflow qualite.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Soumission impossible.'), 'error');
        },
      }),
    );
  }

  approveDocument(document: Document): void {
    this.closeActionMenu();
    this.subscriptions.add(
      this.documentService.approveDocument(document.id).subscribe({
        next: () => {
          this.loadDocuments();
          this.setFeedback('Document valide avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Validation impossible.'), 'error');
        },
      }),
    );
  }

  publishDocument(document: Document): void {
    this.closeActionMenu();
    this.subscriptions.add(
      this.documentService.publishDocument(document.id).subscribe({
        next: () => {
          this.loadDocuments();
          this.setFeedback('Document publie avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Publication impossible.'), 'error');
        },
      }),
    );
  }

  archiveDocument(document: Document): void {
    this.closeActionMenu();
    if (!confirm(`Archiver le document "${document.title}" ?`)) {
      return;
    }
    this.subscriptions.add(
      this.documentService.archiveDocument(document.id).subscribe({
        next: () => {
          this.loadDocuments();
          this.setFeedback('Document archive avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Archivage du document impossible.'), 'error');
        },
      }),
    );
  }

  deleteDocumentPermanently(document: Document): void {
    this.closeActionMenu();
    const reference = document.referenceCode || document.title;
    if (!confirm(`Supprimer definitivement le document "${reference}" ? Cette action est irreversible.`)) {
      return;
    }
    this.subscriptions.add(
      this.documentService.deleteDocumentPermanently(document.id).subscribe({
        next: () => {
          if (this.selectedDocument?.id === document.id) {
            this.selectedDocument = null;
          }
          if (this.previewDocument?.id === document.id) {
            this.closePreview();
          }
          this.loadFolders();
          this.loadDocuments();
          this.setFeedback('Document supprime definitivement.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Suppression definitive impossible.'), 'error');
        },
      }),
    );
  }

  openVersionModal(document: Document): void {
    this.versionTarget = document;
    this.versionUploadFile = null;
    this.versionChangeNote = '';
    this.showVersionModal = true;
    this.syncGedModalChromeVisibility();
    this.clearFeedback();
  }

  closeVersionModal(): void {
    this.showVersionModal = false;
    this.versionTarget = null;
    this.versionUploadFile = null;
    this.syncGedModalChromeVisibility();
  }

  onVersionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.versionUploadFile = null;
      return;
    }
    const validationError = this.validateUploadFile(file);
    if (validationError) {
      this.versionUploadFile = null;
      input.value = '';
      this.setFeedback(validationError, 'error');
      return;
    }
    this.versionUploadFile = file;
  }

  removeVersionFile(): void {
    this.versionUploadFile = null;
  }

  saveVersion(): void {
    if (!this.versionTarget) {
      return;
    }
    if (!this.versionUploadFile) {
      this.setFeedback('Le fichier de version est obligatoire.', 'error');
      return;
    }
    if (this.versionUploadFile.size <= 0) {
      this.setFeedback('Le fichier de version est vide.', 'error');
      return;
    }

    this.isSavingVersion = true;
    this.subscriptions.add(
      this.documentService.addDocumentVersionWithUpload(this.versionTarget.id, {
        changeNote: this.versionChangeNote.trim() || undefined,
      }, this.versionUploadFile).subscribe({
        next: () => {
          this.isSavingVersion = false;
          this.closeVersionModal();
          this.loadDocuments();
          this.setFeedback('Nouvelle version ajoutee.', 'success');
        },
        error: (error: unknown) => {
          this.isSavingVersion = false;
          this.setFeedback(this.toErrorMessage(error, 'Ajout de version impossible.'), 'error');
        },
      }),
    );
  }

  openAclModal(document: Document): void {
    this.aclTarget = document;
    this.aclSelectedRoles = [];
    this.aclSelectedServices = [];
    this.aclConfidentiality = document.confidentialityLevel || 'INTERNAL';
    this.aclServiceOptions = this.buildAclServiceOptions(document, []);
    this.aclServiceSearch = '';
    this.showAclModal = true;
    this.syncGedModalChromeVisibility();
    this.isLoadingAcl = true;

    this.subscriptions.add(
      this.documentService.getDocumentAcl(document.id).subscribe({
        next: (acl) => {
          this.isLoadingAcl = false;
          this.aclSelectedRoles = this.normalizeAclRoles(acl.roles || []);
          this.aclSelectedServices = this.normalizeAclServices(acl.services || []);
          this.aclServiceOptions = this.buildAclServiceOptions(document, this.aclSelectedServices);
        },
        error: (error: unknown) => {
          this.isLoadingAcl = false;
          this.setFeedback(this.toErrorMessage(error, 'Chargement ACL impossible.'), 'error');
        },
      }),
    );
  }

  closeAclModal(): void {
    this.showAclModal = false;
    this.aclTarget = null;
    this.aclSelectedRoles = [];
    this.aclSelectedServices = [];
    this.aclServiceOptions = [];
    this.aclServiceSearch = '';
    this.aclConfidentiality = 'INTERNAL';
    this.isLoadingAcl = false;
    this.syncGedModalChromeVisibility();
  }

  isAclRoleSelected(role: GedAclRole): boolean {
    return this.aclSelectedRoles.includes(role);
  }

  isAclServiceSelected(service: string): boolean {
    return this.aclSelectedServices.includes(service);
  }

  isSystemAclRole(role: GedAclRole): boolean {
    return this.mandatoryAclRoles.includes(role);
  }

  isSystemAclService(service: string): boolean {
    const currentService = this.normalizeText(this.currentUserService).toLowerCase();
    return currentService.length > 0 && this.normalizeText(service).toLowerCase() === currentService;
  }

  toggleAclRole(role: GedAclRole, checked: boolean): void {
    if (this.isSystemAclRole(role)) {
      return;
    }

    const next = new Set(this.aclSelectedRoles);
    if (checked) {
      next.add(role);
    } else {
      next.delete(role);
    }
    this.aclSelectedRoles = this.uniqueSortedValues(Array.from(next)) as GedAclRole[];
  }

  toggleAclService(service: string, checked: boolean): void {
    if (this.isSystemAclService(service) && !checked) {
      return;
    }

    const normalizedService = this.normalizeText(service);
    if (!normalizedService) {
      return;
    }

    const next = new Set(this.aclSelectedServices);
    if (checked) {
      next.add(normalizedService);
    } else {
      next.delete(normalizedService);
    }
    this.aclSelectedServices = this.uniqueSortedValues(Array.from(next));
  }

  filteredAclServiceOptions(): string[] {
    const term = this.normalizeText(this.aclServiceSearch).toLowerCase();
    if (!term) {
      return [...this.aclServiceOptions];
    }
    return this.aclServiceOptions.filter((service) => service.toLowerCase().includes(term));
  }

  aclAudienceSummary(): string {
    const roleLabels = this.aclSelectedRoles.map((role) => this.formatRoleLabel(role));
    const serviceLabels = this.aclSelectedServices.map((service) => `Service ${this.formatServiceLabel(service)}`);
    const parts = [...roleLabels, ...serviceLabels];
    if (parts.length === 0) {
      return 'Aucun destinataire defini.';
    }
    return parts.join(', ');
  }

  aclPermissionsSummary(): string {
    return 'Permissions appliquees: consultation et telechargement selon les regles backend en vigueur.';
  }

  formatConfidentialityLabel(level: GedConfidentialityLevel): string {
    const labels: Record<GedConfidentialityLevel, string> = {
      PUBLIC: 'Public interne',
      INTERNAL: 'Interne',
      RESTRICTED: 'Restreint',
      CONFIDENTIAL: 'Confidentiel',
    };
    return labels[level];
  }

  getConfidentialityBadgeClass(level: GedConfidentialityLevel): string {
    switch (level) {
      case 'PUBLIC':
        return 'bg-success-500/10 text-success-700 dark:text-success-300';
      case 'INTERNAL':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'RESTRICTED':
        return 'bg-warning-500/10 text-warning-700 dark:text-warning-300';
      case 'CONFIDENTIAL':
        return 'bg-error-500/10 text-error-700 dark:text-error-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  }

  saveAcl(): void {
    if (!this.aclTarget) {
      return;
    }

    const target = this.aclTarget;
    const nextRoles = [...this.aclSelectedRoles];
    const nextServices = [...this.aclSelectedServices];
    const nextConfidentiality = this.aclConfidentiality;
    const currentConfidentiality = target.confidentialityLevel || 'INTERNAL';
    const confidentialityChanged = currentConfidentiality !== nextConfidentiality;

    this.isSavingAcl = true;

    const persistAcl = (): void => {
      this.subscriptions.add(
        this.documentService.updateDocumentAcl(target.id, {
          roles: nextRoles,
          services: nextServices,
        }).subscribe({
          next: (aclResponse) => {
            this.isSavingAcl = false;
            this.aclSelectedRoles = this.normalizeAclRoles(aclResponse.roles || []);
            this.aclSelectedServices = this.normalizeAclServices(aclResponse.services || []);
            this.aclServiceOptions = this.buildAclServiceOptions(target, this.aclSelectedServices);
            this.updateDocumentAclLocalState(target.id, nextConfidentiality);
            this.loadDocuments();
            if (this.showAuditPanel) {
              this.loadAuditLogs();
            }
            this.closeAclModal();
            this.setFeedback('Droits d acces mis a jour avec succes.', 'success');
          },
          error: (error: unknown) => {
            this.isSavingAcl = false;
            this.setFeedback(this.toErrorMessage(error, 'Mise a jour ACL impossible.'), 'error');
          },
        }),
      );
    };

    if (!confidentialityChanged) {
      persistAcl();
      return;
    }

    const folderId = target.folderId || this.selectedFolderId;
    if (!folderId) {
      this.isSavingAcl = false;
      this.setFeedback('Dossier introuvable pour mettre a jour la confidentialite.', 'error');
      return;
    }

    this.subscriptions.add(
      this.documentService.updateDocumentMetadata(target.id, {
        folderId,
        title: target.title,
        category: target.category.name,
        subCategory: target.subCategory || undefined,
        description: target.description || undefined,
        confidentialityLevel: nextConfidentiality,
      }).subscribe({
        next: () => {
          persistAcl();
        },
        error: (error: unknown) => {
          this.isSavingAcl = false;
          this.setFeedback(this.toErrorMessage(error, 'Mise a jour de la confidentialite impossible.'), 'error');
        },
      }),
    );
  }

  openPreview(document: Document): void {
    this.selectedDocument = document;
    this.previewDocument = document;
    this.previewData = null;
    this.previewSearch = '';
    this.previewSearchMatches = 0;
    this.previewZoomPercent = 100;
    this.previewPageSize = 1200;
    this.previewPage = 1;
    this.previewTotalPages = 1;
    this.previewFullscreen = false;
    this.previewRenderMode = 'fallback';
    this.previewTextContent = '';
    this.previewFileName = '';
    this.previewMimeType = 'application/octet-stream';
    this.previewFileSize = 0;
    this.previewPdfUrl = null;
    this.previewVersions = [];
    this.previewVersionNumber = null;
    this.previewLinks = [];
    this.selectedLinkedDocumentId = '';
    this.selectedRelationType = 'RELATED';
    this.showPreviewModal = true;
    this.syncGedModalChromeVisibility();
    this.revokePreviewBlobUrl();

    this.loadPreviewVersions();
    this.loadPreviewLinks();
  }

  closePreview(): void {
    this.showPreviewModal = false;
    this.previewDocument = null;
    this.previewData = null;
    this.previewTextContent = '';
    this.previewSearchMatches = 0;
    this.previewFileName = '';
    this.previewMimeType = 'application/octet-stream';
    this.previewFileSize = 0;
    this.previewRenderMode = 'fallback';
    this.previewPdfUrl = null;
    this.previewVersions = [];
    this.previewVersionNumber = null;
    this.previewLinks = [];
    this.revokePreviewBlobUrl();
    this.syncGedModalChromeVisibility();
  }

  private syncGedModalChromeVisibility(): void {
    const hasOpenModal = this.showFolderModal
      || this.showFolderDetailsModal
      || this.showDocumentModal
      || this.showVersionModal
      || this.showAclModal
      || this.showPreviewModal;
    this.setGedModalChromeHidden(hasOpenModal);
  }

  private setGedModalChromeHidden(hidden: boolean): void {
    document.body.classList.toggle('ged-modal-open', hidden);
  }

  private loadPreviewVersions(): void {
    if (!this.previewDocument) {
      return;
    }
    this.subscriptions.add(
      this.documentService.getDocumentVersions(this.previewDocument.id).subscribe({
        next: (versions) => {
          this.previewVersions = versions;
          const selected = versions.length > 0 ? versions[0].versionNumber : null;
          this.previewVersionNumber = selected;
          this.loadPreviewPage(1);
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Chargement des versions impossible.'), 'error');
        },
      }),
    );
  }

  private loadPreviewLinks(): void {
    if (!this.previewDocument) {
      return;
    }
    this.subscriptions.add(
      this.documentService.getDocumentLinks(this.previewDocument.id).subscribe({
        next: (links) => {
          this.previewLinks = links;
        },
        error: () => {
          this.previewLinks = [];
        },
      }),
    );
  }

  loadPreviewPage(page: number): void {
    if (!this.previewDocument) {
      return;
    }

    this.isLoadingPreview = true;
    this.subscriptions.add(
      this.documentService.previewDocument(this.previewDocument.id, {
        versionNumber: this.previewVersionNumber ?? undefined,
        page,
        pageSize: this.previewPageSize,
        zoomPercent: this.previewZoomPercent,
        query: this.previewSearch.trim() || undefined,
      }).subscribe({
        next: (preview) => {
          this.previewData = preview;
          this.previewFileName = preview.fileName || this.previewFileName;
          this.previewMimeType = preview.mimeType || this.previewMimeType;
          this.previewZoomPercent = preview.zoomPercent;
          this.previewPageSize = preview.pageSize;
          this.previewPage = preview.currentPage;
          this.previewTotalPages = preview.totalPages;
          if (this.previewVersionNumber == null) {
            this.previewVersionNumber = preview.versionNumber;
          }
          this.loadPreviewBinary(preview.versionNumber);
        },
        error: (error: unknown) => {
          this.isLoadingPreview = false;
          this.previewRenderMode = 'fallback';
          this.previewTextContent = '';
          this.setFeedback(this.toErrorMessage(error, 'Chargement de l apercu impossible.'), 'error');
        },
      }),
    );
  }

  private loadPreviewBinary(versionNumber: number): void {
    if (!this.previewDocument) {
      this.isLoadingPreview = false;
      return;
    }

    this.subscriptions.add(
      this.documentService.downloadDocumentBinary(this.previewDocument.id, versionNumber).subscribe({
        next: async ({ content, fileName, mimeType, fileSize }) => {
          try {
            this.previewFileName = fileName || this.previewFileName || 'document';
            this.previewMimeType = mimeType || content.type || 'application/octet-stream';
            this.previewFileSize = fileSize > 0 ? fileSize : content.size;
            this.previewRenderMode = resolveGedPreviewRenderMode(this.previewMimeType, this.previewFileName);

            this.revokePreviewBlobUrl();
            this.previewBlobUrl = URL.createObjectURL(content);
            this.refreshPdfPreviewUrl();

            if (this.previewRenderMode === 'text') {
              this.previewTextContent = await content.text();
              this.previewSearchMatches = this.computeTextSearchMatches(this.previewTextContent, this.previewSearch);
              this.previewPage = 1;
              this.previewTotalPages = 1;
            } else {
              this.previewTextContent = '';
              this.previewSearchMatches = 0;
              if (this.previewRenderMode !== 'pdf') {
                this.previewPage = 1;
                this.previewTotalPages = 1;
              }
            }
          } finally {
            this.isLoadingPreview = false;
          }
        },
        error: (error: unknown) => {
          this.isLoadingPreview = false;
          this.previewRenderMode = 'fallback';
          this.previewTextContent = '';
          this.previewSearchMatches = 0;
          this.revokePreviewBlobUrl();
          this.setFeedback(this.toErrorMessage(error, 'Chargement du fichier reel impossible.'), 'error');
        },
      }),
    );
  }

  onPreviewVersionChange(): void {
    this.loadPreviewPage(1);
  }

  searchInPreview(): void {
    if (this.previewRenderMode !== 'text') {
      this.setFeedback('Recherche disponible uniquement pour les documents texte.', 'error');
      return;
    }
    this.loadPreviewPage(1);
  }

  nextPreviewPage(): void {
    if (this.previewRenderMode === 'pdf') {
      const nextPage = Math.min(this.previewPage + 1, this.previewTotalPages || 1);
      if (nextPage !== this.previewPage) {
        this.previewPage = nextPage;
        this.refreshPdfPreviewUrl();
      }
      return;
    }
    if (!this.previewData) {
      return;
    }
    const nextPage = Math.min(this.previewData.currentPage + 1, this.previewData.totalPages);
    if (nextPage !== this.previewData.currentPage) {
      this.loadPreviewPage(nextPage);
    }
  }

  previousPreviewPage(): void {
    if (this.previewRenderMode === 'pdf') {
      const previousPage = Math.max(this.previewPage - 1, 1);
      if (previousPage !== this.previewPage) {
        this.previewPage = previousPage;
        this.refreshPdfPreviewUrl();
      }
      return;
    }
    if (!this.previewData) {
      return;
    }
    const previousPage = Math.max(this.previewData.currentPage - 1, 1);
    if (previousPage !== this.previewData.currentPage) {
      this.loadPreviewPage(previousPage);
    }
  }

  zoomInPreview(): void {
    this.previewZoomPercent = Math.min(this.previewZoomPercent + 10, 200);
    if (this.previewRenderMode === 'pdf') {
      this.refreshPdfPreviewUrl();
      return;
    }
    if (this.previewRenderMode === 'text') {
      this.loadPreviewPage(this.previewData?.currentPage || 1);
    }
  }

  zoomOutPreview(): void {
    this.previewZoomPercent = Math.max(this.previewZoomPercent - 10, 50);
    if (this.previewRenderMode === 'pdf') {
      this.refreshPdfPreviewUrl();
      return;
    }
    if (this.previewRenderMode === 'text') {
      this.loadPreviewPage(this.previewData?.currentPage || 1);
    }
  }

  resetPreviewZoom(): void {
    this.previewZoomPercent = 100;
    if (this.previewRenderMode === 'pdf') {
      this.refreshPdfPreviewUrl();
      return;
    }
    if (this.previewRenderMode === 'text') {
      this.loadPreviewPage(this.previewData?.currentPage || 1);
    }
  }

  togglePreviewFullscreen(): void {
    this.previewFullscreen = !this.previewFullscreen;
  }

  downloadFromPreview(): void {
    if (!this.previewDocument || !this.previewData) {
      return;
    }

    this.subscriptions.add(
      this.documentService.downloadDocumentBinary(this.previewDocument.id, this.previewData.versionNumber).subscribe({
        next: ({ content, fileName }) => {
          this.triggerFileDownload(content, fileName || this.previewData?.fileName || 'document.txt');
          this.setFeedback('Document telecharge avec succes.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Telechargement impossible.'), 'error');
        },
      }),
    );
  }

  printFromPreview(): void {
    if (!this.previewDocument || !this.previewData) {
      return;
    }
    if (!this.canPrintPreview()) {
      this.setFeedback('Impression indisponible pour ce format.', 'error');
      return;
    }

    this.isPrintingPreview = true;
    this.subscriptions.add(
      this.documentService.auditDocumentPrint(this.previewDocument.id, this.previewData.versionNumber).subscribe({
        next: () => {
          this.isPrintingPreview = false;
          this.dispatchPrintEvent();
          this.executePreviewPrint();
        },
        error: (error: unknown) => {
          this.isPrintingPreview = false;
          this.setFeedback(this.toErrorMessage(error, 'Impression impossible.'), 'error');
        },
      }),
    );
  }

  addPreviewLink(): void {
    if (!this.previewDocument || !this.selectedLinkedDocumentId) {
      this.setFeedback('Selectionnez un document cible pour creer le lien.', 'error');
      return;
    }

    this.subscriptions.add(
      this.documentService.addDocumentLink(
        this.previewDocument.id,
        this.selectedLinkedDocumentId,
        this.selectedRelationType,
      ).subscribe({
        next: () => {
          this.selectedLinkedDocumentId = '';
          this.loadPreviewLinks();
          this.setFeedback('Lien documentaire ajoute.', 'success');
        },
        error: (error: unknown) => {
          this.setFeedback(this.toErrorMessage(error, 'Creation du lien impossible.'), 'error');
        },
      }),
    );
  }

  toggleAuditPanel(): void {
    this.showAuditPanel = !this.showAuditPanel;
    if (this.showAuditPanel) {
      this.loadAuditLogs();
    }
  }

  private loadAuditLogs(): void {
    this.isLoadingAuditLogs = true;
    this.subscriptions.add(
      this.documentService.listAuditLogs({ page: 0, size: 30 }).subscribe({
        next: (page) => {
          this.isLoadingAuditLogs = false;
          this.auditLogs = Array.isArray(page.content) ? page.content : [];
        },
        error: (error: unknown) => {
          this.isLoadingAuditLogs = false;
          this.setFeedback(this.toErrorMessage(error, 'Chargement des traces impossible.'), 'error');
        },
      }),
    );
  }

  canSubmit(document: Document): boolean {
    return !document.isArchived && (document.gedStatus === 'Brouillon' || document.gedStatus === 'Refuse');
  }

  canApprove(document: Document): boolean {
    return this.canManageGed() && !document.isArchived && document.gedStatus === 'En attente qualite';
  }

  canPublishDocument(document: Document): boolean {
    return this.canManageGed() && this.canPublish() && !document.isArchived && document.gedStatus === 'Valide qualite';
  }

  formatDate(value: Date | string | undefined): string {
    if (!value) {
      return 'N/A';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleString('fr-FR');
  }

  public formatFileSize(size: number): string {
    if (!Number.isFinite(size) || size <= 0) {
      return '0 o';
    }
    const units = ['o', 'Ko', 'Mo', 'Go'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  formatRoleLabel(role: string): string {
    const mapping: Record<string, string> = {
      ADMIN: 'Administrateur',
      EMPLOYE: 'Employe',
      CHEF_HIERARCHIQUE: 'Chef hierarchique',
      RESPONSABLE_SALLE: 'Responsable salle',
      RESPONSABLE_SECURITE: 'Responsable securite',
      DIRECTEUR_DSN: 'Directeur DSN',
      RESPONSABLE_QUALITE: 'Responsable qualite',
    };
    return mapping[role] || role;
  }

  formatServiceLabel(service: string): string {
    if (!service) {
      return service;
    }
    return service
      .split(/[\s_-]+/)
      .filter((chunk) => !!chunk)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
      .join(' ');
  }

  canSearchInPreview(): boolean {
    return this.previewRenderMode === 'text';
  }

  canNavigatePreviewPages(): boolean {
    if (this.previewRenderMode === 'pdf') {
      return this.previewTotalPages > 1;
    }
    if (this.previewRenderMode === 'text') {
      return (this.previewData?.totalPages || 1) > 1;
    }
    return false;
  }

  canPrintPreview(): boolean {
    return supportsGedPrint(this.previewRenderMode);
  }

  isPreviewMode(mode: GedPreviewRenderMode): boolean {
    return this.previewRenderMode === mode;
  }

  previewPageDisplay(): string {
    if (this.previewRenderMode === 'pdf') {
      return `${this.previewPage} / ${this.previewTotalPages || 1}`;
    }
    return `${this.previewData?.currentPage || 1} / ${this.previewData?.totalPages || 1}`;
  }

  previewFallbackMessage(): string {
    return 'Apercu non disponible pour ce format. Utilisez le telechargement pour consulter le fichier original.';
  }

  toTestIdSlug(value: string): string {
    return this.normalizeText(value).toLowerCase().replace(/\s+/g, '-');
  }

  getStatusTagClass(status: Document['gedStatus']): string {
    switch (status) {
      case 'Publie':
        return 'bg-success-500/10 text-success-700 dark:text-success-300';
      case 'Valide qualite':
      case 'Valide qualite (publiable)':
        return 'bg-brand-500/10 text-brand-700 dark:text-brand-300';
      case 'En attente qualite':
        return 'bg-warning-500/10 text-warning-700 dark:text-warning-300';
      case 'Refuse':
        return 'bg-error-500/10 text-error-700 dark:text-error-300';
      case 'Archive':
        return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  }

  selectedFolderLabel(): string {
    const folder = this.flatFolders.find((item) => item.id === this.selectedFolderId);
    return folder ? folder.breadcrumb : 'Tous les dossiers';
  }

  gedRootFolder(): VisibleFolderNode | null {
    const root = this.visibleFolders.find((folder) => {
      if (folder.archived) {
        return false;
      }
      return this.normalizeText(folder.name).toUpperCase() === 'GED';
    });
    return root || this.visibleFolders.find((folder) => !folder.archived && folder.depth === 0) || null;
  }

  gedSidebarFolders(): VisibleFolderNode[] {
    const root = this.gedRootFolder();
    if (!root) {
      return this.visibleFolders;
    }
    return this.visibleFolders.filter((folder) => this.isDescendantOf(folder.id, root.id));
  }

  isGedRootFolder(folder: VisibleFolderNode): boolean {
    return folder.id === this.gedRootFolder()?.id;
  }

  folderSidebarPadding(folder: VisibleFolderNode): number {
    if (this.isGedRootFolder(folder)) {
      return 8;
    }
    return 16 + Math.max(0, folder.displayDepth - 1) * 14;
  }

  selectedDocumentFolderLabel(): string {
    if (!this.selectedDocument?.folderId) {
      return 'Non defini';
    }
    const folder = this.flatFolders.find((item) => item.id === this.selectedDocument?.folderId);
    return folder?.breadcrumb || this.selectedDocument.folderId;
  }

  folderDetailsChildren(folderId: string): FlatFolderNode[] {
    return this.flatFolders
      .filter((item) => item.parentId === folderId)
      .sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }));
  }

  folderDetailsDocuments(folderId: string): Document[] {
    return this.allDocuments
      .filter((document) => document.folderId === folderId)
      .sort((left, right) => (right.updatedAt?.getTime() || 0) - (left.updatedAt?.getTime() || 0));
  }

  countDocumentsInFolderTree(folderId: string): number {
    const folderIds = new Set<string>();
    this.collectDescendantFolderIds(folderId, folderIds);
    return this.flatFolders
      .filter((folder) => folderIds.has(folder.id))
      .reduce((sum, folder) => sum + (folder.documentCount || 0), 0);
  }

  availableLinkTargets(): Document[] {
    if (!this.previewDocument) {
      return [];
    }
    return this.allDocuments.filter((document) => document.id !== this.previewDocument?.id);
  }

  private flattenFolders(
    nodes: GedFolderTreeNode[],
    depth = 0,
    ancestors: string[] = [],
  ): FlatFolderNode[] {
    const flat: FlatFolderNode[] = [];
    for (const node of nodes) {
      const breadcrumbParts = [...ancestors, node.name];
      flat.push({
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        category: node.category,
        archived: node.archived,
        documentCount: node.documentCount,
        depth,
        breadcrumb: breadcrumbParts.join(' / '),
      });
      flat.push(...this.flattenFolders(node.children || [], depth + 1, breadcrumbParts));
    }
    return flat;
  }

  private buildTabs(nodes: GedFolderTreeNode[]): GedTabItem[] {
    if (!nodes.length) {
      return [];
    }

    const root = nodes[0];
    const tabs: GedTabItem[] = [
      {
        id: root.id,
        folderId: root.id,
        label: this.normalizeTabLabel(root.name || 'GED'),
        count: root.documentCount || 0,
      },
    ];

    (root.children || []).forEach((child) => {
      tabs.push({
        id: child.id,
        folderId: child.id,
        label: this.normalizeTabLabel(child.name),
        count: child.documentCount || 0,
      });
    });

    return tabs;
  }

  private normalizeTabLabel(label: string): string {
    const normalized = this.normalizeText(label).toLowerCase();
    if (normalized.includes('formulaire')) {
      return 'Procedures & formulaires';
    }
    if (normalized.includes('technique')) {
      return 'Procedures techniques';
    }
    if (normalized === 'ged') {
      return 'GED';
    }
    return this.normalizeText(label) || 'GED';
  }

  private ensureActiveTab(): void {
    this.activeTabFolderId = null;
  }

  private refreshVisibleFolders(): void {
    if (!this.flatFolders.length) {
      this.visibleFolders = [];
      return;
    }

    if (!this.activeTabFolderId) {
      this.visibleFolders = this.flatFolders.map((folder) => ({
        ...folder,
        displayDepth: folder.depth,
      }));
      return;
    }

    const activeTabId = this.activeTabFolderId;
    const activeFolder = this.flatFolders.find((folder) => folder.id === activeTabId);
    const baseDepth = activeFolder?.depth ?? 0;
    this.visibleFolders = this.flatFolders
      .filter((folder) => this.isDescendantOf(folder.id, activeTabId))
      .map((folder) => ({
        ...folder,
        displayDepth: Math.max(0, folder.depth - baseDepth),
      }));
  }

  private isDescendantOf(folderId: string, ancestorId: string): boolean {
    let current = this.flatFolders.find((folder) => folder.id === folderId);
    while (current) {
      if (current.id === ancestorId) {
        return true;
      }
      current = current.parentId
        ? this.flatFolders.find((folder) => folder.id === current?.parentId)
        : undefined;
    }
    return false;
  }

  private collectDescendantFolderIds(folderId: string, collector: Set<string>): void {
    collector.add(folderId);
    const children = this.flatFolders.filter((folder) => folder.parentId === folderId);
    children.forEach((child) => this.collectDescendantFolderIds(child.id, collector));
  }

  private resolvePreferredFolderId(): string | null {
    if (!this.flatFolders.length) {
      return null;
    }

    const gedRoot = this.flatFolders.find((folder) => {
      if (folder.archived) {
        return false;
      }
      return this.normalizeText(folder.name).toUpperCase() === 'GED';
    });
    if (gedRoot) {
      return gedRoot.id;
    }

    const folderWithDocuments = [...this.flatFolders]
      .filter((folder) => !folder.archived && (folder.documentCount || 0) > 0)
      .sort((left, right) => {
        if ((right.documentCount || 0) !== (left.documentCount || 0)) {
          return (right.documentCount || 0) - (left.documentCount || 0);
        }
        return left.depth - right.depth;
      })[0];
    if (folderWithDocuments) {
      return folderWithDocuments.id;
    }

    return this.flatFolders.find((folder) => !folder.archived)?.id || this.flatFolders[0]?.id || null;
  }

  private refreshCategoryOptions(): void {
    this.categoryOptions = this.uniqueSortedValues(
      this.allDocuments
        .map((document) => this.normalizeText(document.category?.name))
        .filter((category) => !!category),
    );
    if (this.selectedCategory !== 'ALL' && !this.categoryOptions.includes(this.selectedCategory)) {
      this.selectedCategory = 'ALL';
    }
  }

  private applyDocumentPresentation(resetPage = false): void {
    if (resetPage) {
      this.currentPage = 1;
    }
    let prepared = [...this.allDocuments];
    prepared = prepared.filter((document) => this.matchesCategoryTab(document, this.activeCategoryTab));
    if (this.selectedStatus !== 'ALL') {
      prepared = prepared.filter((document) => document.gedStatus === this.selectedStatus);
    }
    prepared = this.sortDocuments(prepared);
    this.totalDocumentsCount = prepared.length;

    const totalPages = this.totalPages();
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.documents = prepared.slice(startIndex, endIndex);
    this.ensureSelectedDocument();
  }

  private sortDocuments(documents: Document[]): Document[] {
    const compareText = (left: string, right: string): number => left.localeCompare(right, 'fr', { sensitivity: 'base' });
    const compareDate = (left: Date | undefined, right: Date | undefined): number => {
      const leftTime = left ? new Date(left).getTime() : 0;
      const rightTime = right ? new Date(right).getTime() : 0;
      return leftTime - rightTime;
    };

    return [...documents].sort((left, right) => {
      switch (this.selectedSortOption) {
        case 'updatedAsc':
          return compareDate(left.updatedAt, right.updatedAt);
        case 'updatedDesc':
          return compareDate(right.updatedAt, left.updatedAt);
        case 'titleAsc':
          return compareText(left.title || '', right.title || '');
        case 'titleDesc':
          return compareText(right.title || '', left.title || '');
        case 'referenceAsc':
          return compareText(left.referenceCode || '', right.referenceCode || '');
        case 'referenceDesc':
          return compareText(right.referenceCode || '', left.referenceCode || '');
        default:
          return 0;
      }
    });
  }

  private matchesCategoryTab(document: Document, tabId: GedCategoryTabId): boolean {
    if (tabId === 'ALL') {
      return true;
    }

    const categoryText = this.normalizeForCategory([
      document.category?.name,
      document.mainCategory,
      document.subCategory,
      document.categorieNom,
      document.typeCategorie,
    ].filter((value): value is string => !!value).join(' '));
    const isArchive = document.isArchived || document.gedStatus === 'Archive' || document.gedStatus === 'Obsolete';

    if (tabId === 'ARCHIVES') {
      return isArchive;
    }
    if (tabId === 'PROCEDURES') {
      return categoryText.includes('procedure');
    }
    if (tabId === 'FORMULAIRES') {
      return categoryText.includes('formulaire');
    }
    if (tabId === 'TECHNIQUES') {
      return categoryText.includes('technique');
    }
    return true;
  }

  private ensureSelectedDocument(): void {
    if (!this.selectedDocument) {
      this.selectedDocument = this.documents[0] || null;
      return;
    }

    const refreshed = this.documents.find((document) => document.id === this.selectedDocument?.id);
    if (refreshed) {
      this.selectedDocument = refreshed;
      return;
    }

    const fallback = this.allDocuments.find((document) => document.id === this.selectedDocument?.id);
    this.selectedDocument = fallback || this.documents[0] || null;
  }

  private parseCsv(value: string): string[] {
    return Array.from(
      new Set(
        (value || '')
          .split(',')
          .map((item) => item.trim())
          .filter((item) => !!item),
      ),
    );
  }

  private normalizeAclRoles(roles: string[]): GedAclRole[] {
    const allowedRoles = new Set(this.aclRoleOptions);
    return this.uniqueSortedValues(
      (roles || [])
        .map((role) => this.normalizeText(role).toUpperCase())
        .filter((role): role is GedAclRole => allowedRoles.has(role as GedAclRole)),
    ) as GedAclRole[];
  }

  private normalizeAclServices(services: string[]): string[] {
    return this.uniqueSortedValues((services || []).map((service) => this.normalizeText(service)).filter((service) => !!service));
  }

  private buildAclServiceOptions(document: Document, selectedServices: string[]): string[] {
    const services = new Set<string>();
    const collect = (value?: string | null): void => {
      const normalized = this.normalizeText(value);
      if (normalized) {
        services.add(normalized);
      }
    };

    collect(this.currentUserService);
    collect(document.ownerService);
    for (const item of this.allDocuments) {
      collect(item.ownerService);
    }
    for (const service of selectedServices) {
      collect(service);
    }

    return this.uniqueSortedValues(Array.from(services));
  }

  private updateDocumentAclLocalState(documentId: string, confidentiality: GedConfidentialityLevel): void {
    this.documents = this.documents.map((document) => (
      document.id === documentId
        ? { ...document, confidentialityLevel: confidentiality }
        : document
    ));
  }

  private normalizeText(value?: string | null): string {
    return (value || '').trim();
  }

  private normalizeForCategory(value?: string | null): string {
    return this.normalizeText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private uniqueSortedValues(values: string[]): string[] {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  private validateUploadFile(file: File): string | null {
    if (file.size <= 0) {
      return 'Le fichier selectionne est vide.';
    }
    if (file.size > this.maxUploadSizeBytes) {
      return 'Le fichier depasse la taille maximale autorisee (10 Mo).';
    }
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!extension || !this.allowedUploadExtensions.includes(extension)) {
      return 'Type de fichier non autorise.';
    }
    return null;
  }

  private clearFeedback(): void {
    this.feedbackMessage = '';
    this.feedbackTone = 'success';
  }

  private setFeedback(message: string, tone: FeedbackTone): void {
    this.feedbackMessage = message;
    this.feedbackTone = tone;
  }

  private refreshPdfPreviewUrl(): void {
    if (this.previewRenderMode !== 'pdf' || !this.previewBlobUrl) {
      this.previewPdfUrl = null;
      return;
    }
    const page = Math.max(1, this.previewPage);
    const zoom = Math.max(50, Math.min(this.previewZoomPercent, 200));
    const url = `${this.previewBlobUrl}#page=${page}&zoom=${zoom}`;
    this.previewPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private computeTextSearchMatches(content: string, query: string): number {
    const safeQuery = this.normalizeText(query).toLowerCase();
    if (!safeQuery) {
      return 0;
    }
    const haystack = (content || '').toLowerCase();
    if (!haystack) {
      return 0;
    }
    let from = 0;
    let matches = 0;
    while (from < haystack.length) {
      const index = haystack.indexOf(safeQuery, from);
      if (index < 0) {
        break;
      }
      matches += 1;
      from = index + safeQuery.length;
    }
    return matches;
  }

  private executePreviewPrint(): void {
    if (this.previewRenderMode === 'text') {
      this.printTextPreview();
      return;
    }
    if (this.previewRenderMode === 'pdf' || this.previewRenderMode === 'image') {
      this.printBlobPreview();
      return;
    }
    this.setFeedback('Impression indisponible pour ce format.', 'error');
  }

  private printBinaryDocument(content: Blob): void {
    const blobUrl = URL.createObjectURL(content);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    const cleanup = (): void => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      URL.revokeObjectURL(blobUrl);
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(cleanup, 1_000);
      }
    };

    setTimeout(cleanup, 12_000);
  }

  private printBlobPreview(): void {
    if (!this.previewBlobUrl) {
      this.setFeedback('Aucun contenu a imprimer.', 'error');
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = this.previewBlobUrl;
    document.body.appendChild(iframe);

    const cleanup = (): void => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        this.setFeedback('Impression envoyee.', 'success');
      } catch {
        this.setFeedback('Impression impossible sur ce navigateur.', 'error');
      } finally {
        setTimeout(cleanup, 1_000);
      }
    };

    setTimeout(cleanup, 12_000);
  }

  private printTextPreview(): void {
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!popup) {
      this.setFeedback('Veuillez autoriser les fenetres pop-up pour imprimer.', 'error');
      return;
    }

    const escaped = this.previewTextContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    popup.document.write(`
      <html lang="fr">
        <head>
          <title>Impression document GED</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p { margin: 2px 0 12px 0; font-size: 12px; color: #374151; }
            pre { white-space: pre-wrap; font-family: "Courier New", monospace; font-size: 12px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>${this.previewDocument?.title || 'Document GED'}</h1>
          <p>${this.previewData?.referenceCode || ''} • v${this.previewData?.versionNumber || 1} • ${this.previewFileName}</p>
          <pre>${escaped}</pre>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
    this.setFeedback('Impression envoyee.', 'success');
  }

  private dispatchPrintEvent(): void {
    window.dispatchEvent(new CustomEvent('ged-preview-print', {
      detail: {
        documentId: this.previewDocument?.id,
        versionNumber: this.previewData?.versionNumber,
        mode: this.previewRenderMode,
      },
    }));
  }

  private triggerFileDownload(content: Blob, fileName: string): void {
    const url = URL.createObjectURL(content);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2_000);
  }

  private revokePreviewBlobUrl(): void {
    if (!this.previewBlobUrl) {
      this.previewPdfUrl = null;
      return;
    }
    URL.revokeObjectURL(this.previewBlobUrl);
    this.previewBlobUrl = '';
    this.previewPdfUrl = null;
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return 'Action non autorisee.';
      }
      if (error.status === 401) {
        return 'Session invalide. Reconnectez-vous.';
      }
      if (error.status === 404) {
        return 'Ressource introuvable.';
      }
      if (error.status === 400) {
        const detail = typeof error.error === 'object' && typeof error.error?.detail === 'string'
          ? error.error.detail
          : '';
        return detail || 'Donnees invalides.';
      }
      if (error.status === 0) {
        return 'Service GED indisponible.';
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }
}
