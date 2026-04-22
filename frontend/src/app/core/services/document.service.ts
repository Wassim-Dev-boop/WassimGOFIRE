import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { ApiPageResponse, buildApiUrl, extractPageContent } from '../config/backend-api.config';
import { Document, DocumentVersion, Category, DocumentSearchFilter, UserRole } from '../models';

type BackendDocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';

interface BackendDocumentResponse {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  content: string;
  createdBy: string;
  status: BackendDocumentStatus;
  approvedBy?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendDocumentCreateRequest {
  title: string;
  category: string;
  subCategory?: string;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private documentsSubject = new BehaviorSubject<Document[]>([]);
  public documents$ = this.documentsSubject.asObservable();

  private categoriesSubject = new BehaviorSubject<Category[]>([
    {
      id: '1',
      name: 'Procedures et formulaires organisationnels',
      description: 'Catalogue organisationnel et formulaires institutionnels',
      icon: 'folder',
      createdAt: new Date()
    },
    {
      id: '2',
      name: 'Procedures Techniques',
      description: 'Documentation technique et methodes operationnelles',
      icon: 'cpu',
      createdAt: new Date()
    },
    {
      id: '3',
      name: 'Projet de certification du CNSTN',
      description: 'Pieces et dossiers lies au projet de certification',
      icon: 'badge-check',
      createdAt: new Date()
    },
    {
      id: '4',
      name: 'المهام والتراخيص المنجزة',
      description: 'مهام منجزة وتراخيص معتمدة',
      icon: 'clipboard-check',
      createdAt: new Date()
    }
  ]);
  public categories$ = this.categoriesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Category Methods
  getCategories(): Observable<Category[]> {
    return this.categories$;
  }

  addCategory(category: Omit<Category, 'id' | 'createdAt'>): Observable<Category> {
    const newCategory: Category = {
      ...category,
      id: this.generateId(),
      createdAt: new Date()
    };
    this.categoriesSubject.next([...this.categoriesSubject.value, newCategory]);
    return of(newCategory);
  }

  // Document Methods
  getDocuments(): Observable<Document[]> {
    const request$ = this.http
      .get<ApiPageResponse<BackendDocumentResponse>>(buildApiUrl('/api/v1/documents'))
      .pipe(
        map((response) => extractPageContent(response).map((item) => this.mapDocument(item))),
        tap((documents) => this.documentsSubject.next(documents)),
      );

    return this.withFallback(request$, () => of(this.documentsSubject.value));
  }

  getDocumentById(id: string): Observable<Document | undefined> {
    const request$ = this.http
      .get<BackendDocumentResponse>(buildApiUrl(`/api/v1/documents/${id}`))
      .pipe(map((response) => this.mapDocument(response)));

    return this.withFallback(request$, () => of(this.documentsSubject.value.find((doc) => doc.id === id)));
  }

  searchDocuments(filter: DocumentSearchFilter): Observable<Document[]> {
    let results = [...this.documentsSubject.value];

    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      results = results.filter((doc) =>
        doc.title.toLowerCase().includes(term) ||
        (doc.description || '').toLowerCase().includes(term),
      );
    }

    if (filter.categoryId) {
      results = results.filter((doc) => doc.categoryId === filter.categoryId);
    }

    if (filter.author) {
      const author = filter.author.toLowerCase();
      results = results.filter((doc) => doc.author.toLowerCase().includes(author));
    }

    if (filter.startDate && filter.endDate) {
      results = results.filter((doc) => doc.uploadedAt >= filter.startDate! && doc.uploadedAt <= filter.endDate!);
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((doc) => filter.tags!.some((tag) => doc.tags?.includes(tag)));
    }

    return of(results);
  }

  uploadDocument(document: Omit<Document, 'id' | 'uploadedAt' | 'updatedAt' | 'versions'>): Observable<Document> {
    const payload: BackendDocumentCreateRequest = {
      title: document.title,
      category: document.category?.name || document.mainCategory || 'General',
      subCategory: document.subCategory || undefined,
      content: document.description || document.currentVersion.fileName,
    };

    const request$ = this.http
      .post<BackendDocumentResponse>(buildApiUrl('/api/v1/documents'), payload)
      .pipe(
        map((response) => this.mapDocument(response)),
        tap((created) => this.documentsSubject.next([created, ...this.documentsSubject.value])),
      );

    return this.withFallback(request$, () => {
      const newDoc: Document = {
        ...document,
        id: this.generateId(),
        uploadedAt: new Date(),
        updatedAt: new Date(),
        versions: [document.currentVersion],
      };
      this.documentsSubject.next([newDoc, ...this.documentsSubject.value]);
      return of(newDoc);
    });
  }

  updateDocument(id: string, updates: Partial<Document>): Observable<Document | null> {
    const current = this.documentsSubject.value.find((doc) => doc.id === id);
    if (!current) {
      return of(null);
    }

    if (updates.gedStatus) {
      const workflowRequest$ = this.mapWorkflowStatusUpdate(id, updates.gedStatus).pipe(
        tap((updated) => this.replaceDocument(updated)),
      );

      return this.withFallback(workflowRequest$, () => {
        const updated: Document = { ...current, ...updates, updatedAt: new Date() };
        this.replaceDocument(updated);
        return of(updated);
      });
    }

    const updated: Document = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };
    this.replaceDocument(updated);
    return of(updated);
  }

  deleteDocument(id: string): Observable<boolean> {
    this.documentsSubject.next(this.documentsSubject.value.filter((doc) => doc.id !== id));
    return of(true);
  }

  addVersion(documentId: string, version: Omit<DocumentVersion, 'id' | 'uploadedAt'>): Observable<DocumentVersion> {
    const doc = this.documentsSubject.value.find((item) => item.id === documentId);
    if (!doc) {
      return of(null as unknown as DocumentVersion);
    }

    const newVersion: DocumentVersion = {
      ...version,
      id: this.generateId(),
      uploadedAt: new Date(),
    };

    doc.versions.push(newVersion);
    doc.currentVersion = newVersion;
    doc.updatedAt = new Date();
    this.documentsSubject.next([...this.documentsSubject.value]);
    return of(newVersion);
  }

  getDocumentVersions(documentId: string): Observable<DocumentVersion[]> {
    const doc = this.documentsSubject.value.find((item) => item.id === documentId);
    return of(doc?.versions || []);
  }

  downloadDocument(documentId: string, versionId?: string): Observable<string> {
    return this.getDocumentById(documentId).pipe(
      map((doc) => {
        if (!doc) {
          return '';
        }

        const version = versionId ? doc.versions.find((item) => item.id === versionId) : doc.currentVersion;
        return version?.downloadUrl || '';
      }),
    );
  }

  private mapWorkflowStatusUpdate(id: string, status: string): Observable<Document> {
    if (status === 'En attente qualite') {
      return this.http
        .put<BackendDocumentResponse>(buildApiUrl(`/api/v1/documents/${id}/submit`), {})
        .pipe(map((response) => this.mapDocument(response)));
    }

    if (status === 'Valide qualite' || status === 'Valide qualite (publiable)') {
      return this.http
        .put<BackendDocumentResponse>(buildApiUrl(`/api/v1/documents/${id}/approve`), {})
        .pipe(map((response) => this.mapDocument(response)));
    }

    if (status === 'Publie') {
      return this.http
        .put<BackendDocumentResponse>(buildApiUrl(`/api/v1/documents/${id}/publish`), {})
        .pipe(map((response) => this.mapDocument(response)));
    }

    const current = this.documentsSubject.value.find((doc) => doc.id === id);
    if (!current) {
      return of(null as unknown as Document);
    }

    return of({ ...current, gedStatus: status as Document['gedStatus'], updatedAt: new Date() });
  }

  private mapDocument(response: BackendDocumentResponse): Document {
    const uploadedAt = this.toDate(response.createdAt);
    const updatedAt = this.toDate(response.updatedAt, uploadedAt);
    const category = this.resolveCategory(response.category);
    const subCategory = this.resolveSubCategory(category.name, response.subCategory);

    const currentVersion: DocumentVersion = {
      id: `ver-${response.id}`,
      documentId: response.id,
      versionNumber: 1,
      fileName: `${response.title}.txt`,
      fileSize: (response.content || '').length,
      mimeType: 'text/plain',
      uploadedBy: response.createdBy || 'system',
      uploadedAt,
      downloadUrl: this.buildInlineDownloadUrl(response.content || response.title),
    };

    return {
      id: response.id,
      title: response.title,
      description: response.content || '',
      category,
      categoryId: category.id,
      mainCategory: category.name,
      subCategory,
      categorieNom: subCategory,
      typeCategorie: category.name,
      direction: this.mapAuthorToDirection(response.createdBy),
      gedStatus: this.mapGedStatus(response.status),
      referenceCode: `GED-${response.id.slice(0, 8).toUpperCase()}`,
      versions: [currentVersion],
      currentVersion,
      author: response.createdBy || 'system',
      uploadedAt,
      updatedAt,
      accessControl: {
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER],
      },
      tags: [],
      isArchived: false,
      fileSize: currentVersion.fileSize,
      previewUrl: currentVersion.downloadUrl,
    };
  }

  private replaceDocument(updated: Document): void {
    const documents = this.documentsSubject.value;
    const index = documents.findIndex((doc) => doc.id === updated.id);

    if (index < 0) {
      this.documentsSubject.next([updated, ...documents]);
      return;
    }

    documents[index] = updated;
    this.documentsSubject.next([...documents]);
  }

  private resolveCategory(name: string): Category {
    const found = this.categoriesSubject.value.find((category) => category.name.toLowerCase() === name.toLowerCase());
    if (found) {
      return found;
    }

    return {
      id: this.generateId(),
      name,
      description: `Categorie ${name}`,
      createdAt: new Date(),
    };
  }

  private resolveSubCategory(mainCategory: string, subCategory?: string): string {
    const trimmed = (subCategory || '').trim();
    if (trimmed) {
      if (mainCategory === 'Procedures et formulaires organisationnels') {
        const compact = trimmed.replace(/\s+/g, '');
        if (/^pq\d+$/i.test(compact)) {
          return `PQ${compact.substring(2)}`;
        }
      }

      if (mainCategory === 'Procedures Techniques') {
        const compact = trimmed.replace(/\s+/g, '');
        if (/^labo\d+$/i.test(compact)) {
          return `Labo${compact.substring(4)}`;
        }
      }
      return trimmed;
    }

    if (mainCategory === 'Procedures et formulaires organisationnels') {
      return 'PQ1';
    }

    if (mainCategory === 'Procedures Techniques') {
      return 'Labo1';
    }

    return 'Catalogue general';
  }

  private mapGedStatus(status: BackendDocumentStatus): Document['gedStatus'] {
    if (status === 'PUBLISHED') {
      return 'Publie';
    }
    if (status === 'APPROVED') {
      return 'Valide qualite';
    }
    if (status === 'IN_REVIEW') {
      return 'En attente qualite';
    }
    if (status === 'REJECTED') {
      return 'Refuse';
    }
    return 'Brouillon';
  }

  private mapAuthorToDirection(author?: string): string {
    if (!author) {
      return 'Direction';
    }

    const value = author.toLowerCase();
    if (value.includes('qualite')) {
      return 'Qualite';
    }
    if (value.includes('secure') || value.includes('surete') || value.includes('dsn')) {
      return 'Securite';
    }
    if (value.includes('it') || value.includes('dsi')) {
      return 'DSI';
    }
    return 'Direction';
  }

  private buildInlineDownloadUrl(content: string): string {
    const encoded = encodeURIComponent(content || '');
    return `data:text/plain;charset=utf-8,${encoded}`;
  }

  private toDate(value?: string, fallback = new Date()): Date {
    if (!value) {
      return fallback;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  private withFallback<T>(request$: Observable<T>, fallbackFactory: () => Observable<T>): Observable<T> {
    return request$.pipe(
      catchError((error) => throwError(() => error)),
    );
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
