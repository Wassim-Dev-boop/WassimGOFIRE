import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppRole, Category, Document, DocumentVersion, UserRole } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentService } from '../../../core/services/document.service';

type SortMode = 'recent' | 'title' | 'status';
type FeedbackTone = 'success' | 'error';

@Component({
  selector: 'app-ged-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 class="mb-1 text-2xl font-bold text-gray-900 dark:text-white/90 lg:text-3xl">GED</h1>
            <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Organisation appliquee: sous-dossiers directs PQ1..PQn et Labo1..LaboN.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                {{ roleLabels[currentRole] }}
              </span>
              <span class="inline-flex rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-700 dark:text-success-300">
                Consultation requise avant actions
              </span>
            </div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getFilteredDocuments().length }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Documents actifs</p>
          </article>
          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ categories.length }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Categories principales</p>
          </article>
          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getRecentlyAddedCount() }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Ajoutes recemment</p>
          </article>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            [(ngModel)]="searchTerm"
            placeholder="Rechercher un document, un auteur ou une reference..."
            class="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />

          <button
            type="button"
            (click)="toggleQuickFilters()"
            [ngClass]="showQuickFilters ? 'border-brand-500 text-brand-600 dark:text-brand-300' : 'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300'"
            class="h-11 rounded-xl border px-5 text-sm font-semibold transition hover:bg-gray-50 dark:hover:bg-white/[0.03]"
          >
            Filtres
          </button>

          <button
            type="button"
            (click)="cycleSortMode()"
            class="h-11 rounded-xl border border-gray-300 px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Trier: {{ getSortModeLabel() }}
          </button>
        </div>

        <div *ngIf="showQuickFilters" class="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3 dark:border-gray-700 dark:bg-gray-900">
          <select
            [(ngModel)]="statusFilter"
            class="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="all">Tous les statuts</option>
            <option *ngFor="let status of documentStatuses" [value]="status">{{ status }}</option>
          </select>

          <select
            [(ngModel)]="directionFilter"
            class="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="all">Toutes les directions</option>
            <option *ngFor="let direction of directions" [value]="direction">{{ direction }}</option>
          </select>

          <button
            type="button"
            (click)="resetQuickFilters()"
            class="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Reinitialiser
          </button>
        </div>
      </section>

      <section
        *ngFor="let category of categories"
        class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <button
          type="button"
          (click)="toggleCategory(category)"
          class="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-6 py-5 text-left dark:border-gray-800"
        >
          <span class="flex items-center gap-3">
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">
              {{ isCategoryExpanded(category) ? '-' : '+' }}
            </span>
            <span class="text-2xl font-semibold text-gray-900 dark:text-white/90">{{ category }}</span>
          </span>

          <span class="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {{ getSubCategoriesForMainCategory(category).length }} sous-dossiers
          </span>
        </button>

        <div *ngIf="isCategoryExpanded(category)">
          <div *ngFor="let subCategory of getSubCategoriesForMainCategory(category); let index = index" class="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
            <button
              type="button"
              (click)="selectSubCategory(category, subCategory)"
              class="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              [ngClass]="isSubCategoryActive(category, subCategory) ? 'bg-brand-50/60 dark:bg-brand-500/10' : ''"
            >
              <span class="flex items-center gap-3">
                <span class="inline-flex h-5 w-5 items-center justify-center text-sm text-gray-500">{{ isSubCategoryActive(category, subCategory) ? 'v' : '>' }}</span>
                <span class="text-2xl font-semibold text-gray-900 dark:text-white/90">
                  {{ getSubCategoryDisplayName(category, subCategory, index) }}
                </span>
              </span>

              <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {{ getDocumentsForSubCategory(category, subCategory).length }}
              </span>
            </button>

            <div *ngIf="isSubCategoryActive(category, subCategory)" class="px-6 pb-6">
              <div class="mb-4 rounded-xl border border-brand-200 bg-brand-50/40 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                Consulter un document est obligatoire avant telechargement ou upload.
              </div>

              <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nom du document</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Taille</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                    <tr *ngFor="let doc of getDocumentsForSubCategory(category, subCategory)">
                      <td class="px-4 py-4">
                        <p class="text-base font-semibold text-gray-900 dark:text-white/90">{{ doc.title }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ getReference(doc) }}</p>
                      </td>
                      <td class="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{{ getDateLabel(doc) }}</td>
                      <td class="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{{ formatBytes(getDocumentSize(doc)) }}</td>
                      <td class="px-4 py-4">
                        <div class="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            (click)="consultDocument(doc, category, subCategory)"
                            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                          >
                            Consulter
                          </button>

                          <button
                            type="button"
                            (click)="download(doc)"
                            [disabled]="!hasConsultedDocument(doc.id)"
                            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-500/10"
                          >
                            Telecharger
                          </button>

                          <button
                            *ngIf="canUploadDocuments()"
                            type="button"
                            (click)="openUploadForSubCategory(category, subCategory)"
                            [disabled]="!canUploadForSubCategory(category, subCategory)"
                            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-500/10"
                          >
                            Upload
                          </button>
                        </div>
                      </td>
                    </tr>

                    <tr *ngIf="getDocumentsForSubCategory(category, subCategory).length === 0">
                      <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Aucun document disponible dans {{ subCategory }}.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                *ngIf="showUploadPanel && selectedUploadCategory === category && selectedUploadSubCategory === subCategory && canUploadDocuments()"
                class="mt-5 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10"
              >
                <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white/90">
                  Upload vers {{ subCategory }}
                </h3>

                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Titre</label>
                    <input
                      type="text"
                      [(ngModel)]="uploadTitle"
                      placeholder="Titre du document"
                      class="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  </div>

                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fichier (optionnel)</label>
                    <input
                      type="file"
                      (change)="onUploadFileChange($event)"
                      class="block h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    />
                  </div>

                  <div class="md:col-span-2">
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Description / contenu</label>
                    <textarea
                      [(ngModel)]="uploadDescription"
                      rows="3"
                      placeholder="Description courte du document"
                      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    ></textarea>
                  </div>
                </div>

                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ uploadFileName ? (uploadFileName + ' (' + formatBytes(uploadFileSize) + ')') : 'Aucun fichier selectionne' }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      (click)="closeUploadPanel()"
                      class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      (click)="submitUpload()"
                      [disabled]="isUploading"
                      class="rounded-lg bg-success-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-success-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {{ isUploading ? 'Upload en cours...' : 'Envoyer' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        *ngIf="previewDocument"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"
      >
        <div class="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white/90">{{ previewDocument.title }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ getDateLabel(previewDocument) }} - {{ formatBytes(getDocumentSize(previewDocument)) }}</p>
            </div>

            <button
              type="button"
              (click)="closePreview()"
              class="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Fermer
            </button>
          </div>

          <div class="max-h-[60vh] overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <pre class="whitespace-pre-wrap font-sans">{{ previewDocument.description || previewDocument.currentVersion.fileName || 'Apercu indisponible' }}</pre>
          </div>
        </div>
      </div>

      <div
        *ngIf="feedbackMessage"
        class="rounded-xl border px-4 py-2 text-sm"
        [ngClass]="feedbackTone === 'success'
          ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-300'
          : 'border-error-200 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-300'"
      >
        {{ feedbackMessage }}
      </div>
    </div>
  `,
  styles: []
})
export class GedListComponent implements OnInit {
  readonly organisationCategory = 'Procedures et formulaires organisationnels';
  readonly technicalCategory = 'Procedures Techniques';

  readonly categories: string[] = [
    'Procedures et formulaires organisationnels',
    'Procedures Techniques',
  ];

  readonly documentStatuses: string[] = [
    'Publie',
    'Valide qualite',
    'Valide qualite (publiable)',
    'En attente qualite',
    'Brouillon',
    'Refuse',
    'Archive',
    'Obsolete'
  ];

  readonly directions: string[] = ['DSI', 'Qualite', 'Securite', 'Ressources', 'Direction'];

  private readonly minimumOrganisationGroups = 3;
  private readonly minimumTechnicalGroups = 3;

  documents: Document[] = [];
  searchTerm = '';
  showQuickFilters = false;
  statusFilter = 'all';
  directionFilter = 'all';
  sortMode: SortMode = 'recent';

  currentRole: AppRole = 'EMPLOYEE';
  currentUserName = 'Current User';

  expandedCategories = new Set<string>([this.organisationCategory, this.technicalCategory]);
  activeSubCategoryByCategory: Record<string, string | null> = {
    [this.organisationCategory]: 'PQ1',
    [this.technicalCategory]: 'Labo1',
  };

  consultedDocumentIds = new Set<string>();
  consultedSubCategoryKeys = new Set<string>();
  previewDocument: Document | null = null;

  showUploadPanel = false;
  selectedUploadCategory: string | null = null;
  selectedUploadSubCategory: string | null = null;
  uploadTitle = '';
  uploadDescription = '';
  uploadFileName = '';
  uploadFileSize = 0;
  isUploading = false;

  feedbackMessage = '';
  feedbackTone: FeedbackTone = 'success';

  readonly roleLabels: Record<AppRole, string> = {
    ADMIN: 'Administrateur',
    EMPLOYEE: 'Employe',
    MANAGER: 'Chef hierarchique',
    ROOM_MANAGER: 'Responsable salle',
    SECURITY_MANAGER: 'Responsable securite',
    DSN_DIRECTOR: 'Directeur DSN',
    QUALITY_MANAGER: 'Responsable qualite'
  };

  constructor(
    private documentService: DocumentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      if (!user) {
        return;
      }

      this.currentRole = user.role;
      this.currentUserName = `${user.firstName} ${user.lastName}`.trim();
    });

    this.loadDocuments();
  }

  loadDocuments(): void {
    this.documentService.getDocuments().subscribe((docs) => {
      this.documents = Array.isArray(docs) ? docs : [];
    });
  }

  toggleQuickFilters(): void {
    this.showQuickFilters = !this.showQuickFilters;
  }

  resetQuickFilters(): void {
    this.statusFilter = 'all';
    this.directionFilter = 'all';
  }

  cycleSortMode(): void {
    const sortOrder: SortMode[] = ['recent', 'title', 'status'];
    const currentIndex = sortOrder.indexOf(this.sortMode);
    this.sortMode = sortOrder[(currentIndex + 1) % sortOrder.length];
  }

  getSortModeLabel(): string {
    const labels: Record<SortMode, string> = {
      recent: 'recents',
      title: 'titre',
      status: 'statut'
    };
    return labels[this.sortMode];
  }

  toggleCategory(category: string): void {
    if (this.expandedCategories.has(category)) {
      this.expandedCategories.delete(category);
      this.closeUploadPanel();
      return;
    }

    this.expandedCategories.add(category);
  }

  isCategoryExpanded(category: string): boolean {
    return this.expandedCategories.has(category);
  }

  selectSubCategory(category: string, subCategory: string): void {
    this.activeSubCategoryByCategory[category] = subCategory;
    this.closeUploadPanel();
    this.clearFeedback();
  }

  isSubCategoryActive(category: string, subCategory: string): boolean {
    return this.activeSubCategoryByCategory[category] === subCategory;
  }

  getFilteredDocuments(): Document[] {
    let scoped = this.documents.filter((doc) => this.matchesSearch(doc));

    if (this.statusFilter !== 'all') {
      scoped = scoped.filter((doc) => (doc.gedStatus || 'Brouillon') === this.statusFilter);
    }

    if (this.directionFilter !== 'all') {
      scoped = scoped.filter((doc) => (doc.direction || 'Direction') === this.directionFilter);
    }

    return this.sortDocuments(scoped);
  }

  getDocumentsForSubCategory(category: string, subCategory: string): Document[] {
    return this.getFilteredDocuments()
      .filter((doc) => this.getMainCategoryName(doc) === category)
      .filter((doc) => this.getDocumentSubCategory(doc) === subCategory)
      .sort((a, b) => this.getDocumentTimestamp(b) - this.getDocumentTimestamp(a));
  }

  getSubCategoriesForMainCategory(mainCategory: string): string[] {
    if (mainCategory === this.organisationCategory) {
      const maxIndex = Math.max(
        this.minimumOrganisationGroups,
        ...this.collectIndexesFor(mainCategory, /^PQ(\d+)$/i)
      );
      return this.buildSequentialGroups('PQ', maxIndex);
    }

    if (mainCategory === this.technicalCategory) {
      const maxIndex = Math.max(
        this.minimumTechnicalGroups,
        ...this.collectIndexesFor(mainCategory, /^Labo(\d+)$/i)
      );
      return this.buildSequentialGroups('Labo', maxIndex);
    }

    return ['General'];
  }

  getSubCategoryDisplayName(category: string, subCategory: string, index: number): string {
    if (category === this.organisationCategory) {
      return `${subCategory} - Procedure Qualite ${index + 1}`;
    }

    if (category === this.technicalCategory) {
      return `${subCategory} - Laboratoire ${index + 1}`;
    }

    return subCategory;
  }

  consultDocument(doc: Document, category: string, subCategory: string): void {
    this.consultedDocumentIds.add(doc.id);
    this.consultedSubCategoryKeys.add(this.buildSubCategoryKey(category, subCategory));
    this.previewDocument = doc;
    this.setFeedback(`Consultation enregistree pour ${doc.title}.`, 'success');
  }

  closePreview(): void {
    this.previewDocument = null;
  }

  hasConsultedDocument(documentId: string): boolean {
    return this.consultedDocumentIds.has(documentId);
  }

  canUploadDocuments(): boolean {
    return this.currentRole === 'QUALITY_MANAGER' && this.authService.hasPermission('PUBLISH_DOCUMENT');
  }

  canUploadForSubCategory(category: string, subCategory: string): boolean {
    if (!this.canUploadDocuments()) {
      return false;
    }

    return this.consultedSubCategoryKeys.has(this.buildSubCategoryKey(category, subCategory));
  }

  openUploadForSubCategory(category: string, subCategory: string): void {
    if (!this.canUploadForSubCategory(category, subCategory)) {
      this.setFeedback('Consultez d abord un document de ce sous-dossier avant upload.', 'error');
      return;
    }

    this.showUploadPanel = true;
    this.selectedUploadCategory = category;
    this.selectedUploadSubCategory = subCategory;
    this.clearFeedback();
  }

  closeUploadPanel(): void {
    this.showUploadPanel = false;
    this.selectedUploadCategory = null;
    this.selectedUploadSubCategory = null;
    this.isUploading = false;
    this.resetUploadFields();
  }

  onUploadFileChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files && input.files.length > 0 ? input.files[0] : null;

    if (!file) {
      this.uploadFileName = '';
      this.uploadFileSize = 0;
      return;
    }

    this.uploadFileName = file.name;
    this.uploadFileSize = file.size;
  }

  submitUpload(): void {
    if (!this.canUploadDocuments()) {
      this.setFeedback('Upload reserve au responsable qualite.', 'error');
      return;
    }

    if (!this.selectedUploadCategory || !this.selectedUploadSubCategory) {
      this.setFeedback('Selectionnez un sous-dossier avant upload.', 'error');
      return;
    }

    if (!this.canUploadForSubCategory(this.selectedUploadCategory, this.selectedUploadSubCategory)) {
      this.setFeedback('Consultez un fichier du sous-dossier avant upload.', 'error');
      return;
    }

    const safeTitle = this.uploadTitle.trim();
    if (!safeTitle) {
      this.setFeedback('Le titre du document est obligatoire.', 'error');
      return;
    }

    const description = this.uploadDescription.trim();
    const fileName = this.uploadFileName || `${safeTitle.replace(/\s+/g, '_')}.txt`;
    const fileSize = this.uploadFileSize || Math.max(description.length, 1);

    const draft = this.buildUploadDraft(
      safeTitle,
      description,
      fileName,
      fileSize,
      this.selectedUploadCategory,
      this.selectedUploadSubCategory
    );

    this.isUploading = true;
    this.documentService.uploadDocument(draft).subscribe({
      next: () => {
        this.isUploading = false;
        this.loadDocuments();
        const targetSubCategory = this.selectedUploadSubCategory;
        this.closeUploadPanel();
        this.setFeedback(`Document ajoute dans ${targetSubCategory}.`, 'success');
      },
      error: (error: unknown) => {
        this.isUploading = false;
        this.setFeedback(this.toUploadErrorMessage(error), 'error');
      }
    });
  }

  download(doc: Document): void {
    if (!this.hasConsultedDocument(doc.id)) {
      this.setFeedback('Consultez le document avant telechargement.', 'error');
      return;
    }

    this.documentService.downloadDocument(doc.id).subscribe((url) => {
      if (!url) {
        this.setFeedback('Lien de telechargement introuvable.', 'error');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = doc.currentVersion.fileName;
      anchor.click();
    });
  }

  getRecentlyAddedCount(days = 30): number {
    const docs = this.getFilteredDocuments();
    if (docs.length === 0) {
      return 0;
    }

    const referenceTimestamp = Math.max(...docs.map((doc) => this.getDocumentTimestamp(doc)));
    const cutoffTimestamp = referenceTimestamp - days * 24 * 60 * 60 * 1000;
    return docs.filter((doc) => this.getDocumentTimestamp(doc) >= cutoffTimestamp).length;
  }

  getDateLabel(doc: Document): string {
    const timestamp = this.getDocumentTimestamp(doc);
    if (!timestamp) {
      return 'N/A';
    }

    return new Date(timestamp).toLocaleDateString('fr-FR');
  }

  getDocumentSize(doc: Document): number {
    if (doc.currentVersion?.fileSize && doc.currentVersion.fileSize > 0) {
      return doc.currentVersion.fileSize;
    }
    if (doc.fileSize && doc.fileSize > 0) {
      return doc.fileSize;
    }
    return 0;
  }

  formatBytes(size: number): string {
    if (!Number.isFinite(size) || size <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  getReference(doc: Document): string {
    if (doc.referenceCode && doc.referenceCode.trim()) {
      return doc.referenceCode;
    }
    return `GED-${doc.id.slice(0, 8).toUpperCase()}`;
  }

  private sortDocuments(docs: Document[]): Document[] {
    const sorted = [...docs];

    if (this.sortMode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
      return sorted;
    }

    if (this.sortMode === 'status') {
      sorted.sort((a, b) => (a.gedStatus || 'Brouillon').localeCompare(b.gedStatus || 'Brouillon', 'fr', { sensitivity: 'base' }));
      return sorted;
    }

    sorted.sort((a, b) => this.getDocumentTimestamp(b) - this.getDocumentTimestamp(a));
    return sorted;
  }

  private matchesSearch(doc: Document): boolean {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }

    return [
      doc.title,
      doc.description || '',
      doc.author || '',
      doc.referenceCode || '',
      this.getMainCategoryName(doc),
      this.getDocumentSubCategory(doc)
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  }

  private getMainCategoryName(doc: Document): string {
    return (doc.mainCategory || doc.category?.name || 'Catalogue general').trim();
  }

  private getDocumentSubCategory(doc: Document): string {
    const mainCategory = this.getMainCategoryName(doc);
    const raw = (doc.subCategory || '').trim();

    if (mainCategory === this.organisationCategory) {
      const compact = raw.replace(/\s+/g, '');
      if (/^pq\d+$/i.test(compact)) {
        return `PQ${compact.substring(2)}`;
      }
      return 'PQ1';
    }

    if (mainCategory === this.technicalCategory) {
      const compact = raw.replace(/\s+/g, '');
      if (/^labo\d+$/i.test(compact)) {
        return `Labo${compact.substring(4)}`;
      }
      return 'Labo1';
    }

    return raw || 'General';
  }

  private collectIndexesFor(mainCategory: string, pattern: RegExp): number[] {
    return this.documents
      .filter((doc) => this.getMainCategoryName(doc) === mainCategory)
      .map((doc) => this.getDocumentSubCategory(doc))
      .map((subCategory) => {
        const match = pattern.exec(subCategory);
        if (!match) {
          return 1;
        }

        const parsed = Number.parseInt(match[1], 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      });
  }

  private buildSequentialGroups(prefix: 'PQ' | 'Labo', maxIndex: number): string[] {
    const safeMax = Number.isFinite(maxIndex) && maxIndex > 0 ? maxIndex : 1;
    return Array.from({ length: safeMax }, (_, index) => `${prefix}${index + 1}`);
  }

  private getDocumentTimestamp(doc: Document): number {
    const updated = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
    const uploaded = doc.uploadedAt ? new Date(doc.uploadedAt).getTime() : 0;
    return Math.max(updated, uploaded, 0);
  }

  private buildUploadDraft(
    title: string,
    description: string,
    fileName: string,
    fileSize: number,
    mainCategory: string,
    subCategory: string
  ): Omit<Document, 'id' | 'uploadedAt' | 'updatedAt' | 'versions'> {
    const now = new Date();

    const category: Category = {
      id: this.buildCategoryId(mainCategory),
      name: mainCategory,
      description: `Categorie ${mainCategory}`,
      createdAt: now,
    };

    const currentVersion: DocumentVersion = {
      id: `tmp-${Date.now()}`,
      documentId: 'pending',
      versionNumber: 1,
      fileName,
      fileSize,
      mimeType: 'application/octet-stream',
      uploadedBy: this.currentUserName || 'responsable.qualite',
      uploadedAt: now,
      downloadUrl: this.buildInlineDownloadUrl(description || title),
      changeLog: 'Creation initiale',
    };

    return {
      title,
      description,
      category,
      categoryId: category.id,
      mainCategory,
      subCategory,
      categorieNom: subCategory,
      typeCategorie: mainCategory,
      direction: 'Qualite',
      gedStatus: 'Brouillon',
      referenceCode: `GED-TMP-${Date.now()}`,
      currentVersion,
      author: this.currentUserName || 'responsable.qualite',
      accessControl: {
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER],
      },
      tags: [],
      isArchived: false,
      fileSize,
      previewUrl: currentVersion.downloadUrl,
    };
  }

  private buildCategoryId(mainCategory: string): string {
    if (mainCategory === this.organisationCategory) {
      return '1';
    }

    if (mainCategory === this.technicalCategory) {
      return '2';
    }

    return `cat-${mainCategory.toLowerCase().replace(/\s+/g, '-')}`;
  }

  private buildInlineDownloadUrl(content: string): string {
    const encoded = encodeURIComponent(content || 'document');
    return `data:text/plain;charset=utf-8,${encoded}`;
  }

  private buildSubCategoryKey(category: string, subCategory: string): string {
    return `${category}::${subCategory}`;
  }

  private resetUploadFields(): void {
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.uploadFileName = '';
    this.uploadFileSize = 0;
  }

  private clearFeedback(): void {
    this.feedbackMessage = '';
    this.feedbackTone = 'success';
  }

  private setFeedback(message: string, tone: FeedbackTone): void {
    this.feedbackMessage = message;
    this.feedbackTone = tone;
  }

  private toUploadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return 'Upload refuse: operation reservee au responsable qualite autorise.';
      }

      if (error.status === 401) {
        return 'Session invalide. Reconnectez-vous.';
      }

      if (error.status === 400) {
        return 'Requete invalide. Verifiez le titre et la categorie.';
      }

      if (error.status === 0) {
        return 'Service GED indisponible.';
      }
    }

    return "Echec de l'upload du document.";
  }
}
