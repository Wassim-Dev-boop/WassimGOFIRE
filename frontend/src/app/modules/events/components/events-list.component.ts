import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { EventInput, CalendarOptions, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import { EventService } from '../../../core/services/event.service';
import { InvitationService } from '../../../core/services/invitation.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppRole, Event, EventStatus, InvitationStatus } from '../../../core/models';
import { Option, SelectComponent } from '../../../shared/components/form/select/select.component';

type CalendarVisualLevel = 'Danger' | 'Success' | 'Primary' | 'Warning';
type EventSortMode = 'recent' | 'title' | 'status';
type CalendarInviteFeedbackTone = 'success' | 'error';

interface CalendarPartnerInviteDispatchResult {
  sentCount: number;
  failedCount: number;
  failedEmails: string[];
}

declare global {
  interface Window {
    ZoomMtgEmbedded?: {
      createClient: () => any;
    };
  }
}

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, SelectComponent],
  template: `
    <div class="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 class="mb-1 text-2xl font-bold text-gray-900 dark:text-white/90 lg:text-3xl">Evenements</h1>
            <p class="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Planification, validation et participation aux evenements internes dans un flux unique.
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                {{ roleLabels[currentRole] }}
              </span>
              <span class="inline-flex rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-700 dark:text-success-300">
                Workflow actif
              </span>
            </div>
          </div>

          <div class="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <button
              (click)="viewMode = 'list'"
              [ngClass]="viewMode === 'list' ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]'"
              class="rounded-xl border px-5 py-2.5 text-sm font-semibold transition"
            >
              Vue liste
            </button>
            <button
              (click)="viewMode = 'calendar'"
              [ngClass]="viewMode === 'calendar' ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.03]'"
              class="rounded-xl border px-5 py-2.5 text-sm font-semibold transition"
            >
              Vue calendrier
            </button>
            <button
              *ngIf="canCreateEvents()"
              (click)="openCalendarModal()"
              class="rounded-xl bg-success-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-success-600"
            >
              Nouvel evenement
            </button>
          </div>
        </div>

        <div
          *ngIf="calendarSubmissionFeedback"
          class="mt-5 rounded-xl border px-4 py-3 text-sm font-medium"
          [ngClass]="calendarSubmissionFeedbackTone === 'success'
            ? 'border-success-300 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-300'
            : 'border-error-300 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-300'"
        >
          {{ calendarSubmissionFeedback }}
        </div>

        <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ events.length }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Evenements total</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getPublishedEventsCount() }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Publies</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ pendingEvents.length }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">En attente validation</p>
          </article>

          <article class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
            <p class="text-3xl font-semibold text-gray-900 dark:text-white/90">{{ getReferenceMonthCount() }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Programmes recemment</p>
          </article>
        </div>

        <div *ngIf="viewMode === 'list'" class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <input
            type="text"
            [(ngModel)]="searchTerm"
            placeholder="Rechercher un evenement, lieu, organisateur..."
            class="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />

          <app-select
            [(ngModel)]="statusFilter"
            [options]="statusFilterOptions"
            placeholder="Tous les statuts"
            className="bg-white dark:bg-gray-900"
          ></app-select>

          <app-select
            [(ngModel)]="typeFilter"
            [options]="typeFilterOptions"
            placeholder="Tous les types"
            className="bg-white dark:bg-gray-900"
          ></app-select>

          <button
            type="button"
            (click)="cycleSortMode()"
            class="h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Trier: {{ getSortModeLabel() }}
          </button>
        </div>
      </section>

      <section *ngIf="viewMode === 'list'" class="space-y-5">
        <div
          *ngIf="canApproveEvents() && pendingEvents.length > 0"
          class="rounded-2xl border border-warning-300 bg-warning-50 p-5 dark:border-warning-500/40 dark:bg-warning-500/10"
        >
          <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-warning-700 dark:text-warning-300">
            Demandes en attente de validation
          </h3>

          <div class="space-y-3">
            <article
              *ngFor="let request of pendingEvents"
              class="flex flex-col gap-3 rounded-xl border border-warning-200 bg-white p-4 dark:border-warning-500/40 dark:bg-gray-900"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-base font-semibold text-gray-900 dark:text-white/90">{{ request.title }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ request.onlineEvent ? 'En ligne (Zoom)' : request.location }} - {{ request.startDate | date:'short' }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    (click)="approveEvent(request)"
                    class="rounded-lg bg-success-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-success-600"
                  >
                    Approuver
                  </button>
                  <button
                    (click)="rejectEvent(request)"
                    class="rounded-lg bg-error-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-error-600"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div *ngIf="filteredEvents.length === 0" class="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-white/[0.03]">
          <p class="text-lg font-semibold text-gray-800 dark:text-white/90">Aucun evenement trouve</p>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Ajustez vos filtres ou creez un nouvel evenement.</p>
        </div>

        <div *ngIf="filteredEvents.length > 0" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            *ngFor="let event of filteredEvents"
            class="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500"
          >
            <div class="mb-4 h-1.5 rounded-full" [ngClass]="getEventAccentClass(event.type)"></div>

            <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
              <h3 class="line-clamp-2 text-lg font-semibold text-gray-900 dark:text-white/90">{{ event.title }}</h3>
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [ngClass]="getEventTypeBadgeClass(event.type)">
                  {{ event.type }}
                </span>
                <span
                  *ngIf="event.onlineEvent"
                  class="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300"
                >
                  En ligne (Zoom)
                </span>
              </div>
            </div>

            <p class="mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{{ event.description || 'Aucune description.' }}</p>

            <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span class="font-semibold">{{ event.onlineEvent ? 'Acces' : 'Lieu' }}:</span> {{ event.onlineEvent ? 'Reunion Zoom integree' : event.location }}</p>
              <p><span class="font-semibold">Date:</span> {{ getEventDateRangeLabel(event) }}</p>
              <p><span class="font-semibold">Organisateur:</span> {{ event.organiserName }}</p>
            </div>

            <div class="mt-4">
              <div class="mb-1 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
                <span>Participation</span>
                <span>{{ event.participants.length }} / {{ event.maxParticipants || 0 }}</span>
              </div>
              <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div class="h-2 rounded-full bg-brand-500" [style.width.%]="getParticipantFill(event)"></div>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [ngClass]="getEventStatusBadgeClass(event.status)">
                {{ getEventStatusLabel(event.status) }}
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">Mis a jour {{ event.updatedAt | date:'shortDate' }}</span>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                (click)="viewEvent(event)"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Ouvrir
              </button>
              <button
                *ngIf="canEditEvent(event)"
                (click)="editEvent(event)"
                class="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Modifier
              </button>
            </div>

            <div *ngIf="canApproveEvents() && event.status === 'DRAFT'" class="mt-3 grid grid-cols-2 gap-2">
              <button
                (click)="approveEvent(event)"
                class="rounded-lg bg-success-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-success-600"
              >
                Approuver
              </button>
              <button
                (click)="rejectEvent(event)"
                class="rounded-lg bg-error-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-error-600"
              >
                Refuser
              </button>
            </div>
          </article>
        </div>
      </section>

      <section *ngIf="viewMode === 'calendar'" class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white/90">Calendrier des evenements</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">Vue mensuelle, hebdomadaire et journaliere.</p>
          </div>

          <button
            *ngIf="canCreateEvents()"
            (click)="openCalendarModal()"
            class="rounded-xl bg-success-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-success-600"
          >
            Ajouter un evenement
          </button>
        </div>

        <div class="custom-calendar p-5">
          <full-calendar #calendar [options]="calendarOptions"></full-calendar>
        </div>
      </section>

      <div *ngIf="isCalendarModalOpen" class="fixed inset-0 z-[110000] flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm">
        <div class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white/90">{{ selectedEventForModal ? 'Modifier evenement' : 'Ajouter evenement' }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Date selectionnee: {{ getModalDateHint() }}</p>
            </div>
            <button
              (click)="closeCalendarModal()"
              class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Fermer
            </button>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Titre <span class="text-error-500">*</span></label>
              <input
                type="text"
                [(ngModel)]="calendarEventTitle"
                placeholder="Ex: Revue trimestrielle"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Description</label>
              <textarea
                rows="3"
                [(ngModel)]="calendarEventDescription"
                placeholder="Detaillez l objectif et les points cles..."
                class="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              ></textarea>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                {{ calendarEventOnline ? 'Lien / canal de reunion' : 'Lieu' }}
                <span *ngIf="!calendarEventOnline" class="text-error-500">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="calendarEventLocation"
                [placeholder]="calendarEventOnline ? 'Ex: Salle Zoom CNSTN (optionnel)' : 'Ex: Salle conference A'"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Type</label>
              <app-select
                [(ngModel)]="calendarEventType"
                [options]="eventTypeSelectOptions"
                placeholder="Type"
              ></app-select>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Debut</label>
              <input
                type="date"
                [(ngModel)]="calendarEventStartDate"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Fin</label>
              <input
                type="date"
                [(ngModel)]="calendarEventEndDate"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Statut</label>
              <ng-container *ngIf="canApproveEvents(); else autoStatus">
                <app-select
                  [(ngModel)]="calendarEventStatus"
                  [options]="eventStatusSelectOptions"
                  placeholder="Statut"
                ></app-select>
              </ng-container>
              <ng-template #autoStatus>
                <div class="h-11 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  EN ATTENTE (automatique)
                </div>
              </ng-template>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Participants max</label>
              <input
                type="number"
                min="1"
                [(ngModel)]="calendarEventMaxParticipants"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">Mode evenement</label>
              <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-brand-400/70 bg-brand-500/5 px-4 py-3 text-sm text-gray-700 transition hover:border-brand-500 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-gray-200">
                <span class="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    [(ngModel)]="calendarEventOnline"
                    (ngModelChange)="onCalendarOnlineModeChange()"
                    class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span class="font-semibold">Evenement en ligne (Zoom SDK integre)</span>
                </span>
                <span
                  *ngIf="calendarEventOnline"
                  class="rounded-full border border-success-300 bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-300"
                >
                  Actif
                </span>
              </label>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Activez pour permettre aux participants de rejoindre la reunion depuis la plateforme et inviter des partenaires externes.
              </p>
            </div>

            <div *ngIf="calendarEventOnline">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">ID reunion Zoom <span class="text-error-500">*</span></label>
              <input
                type="text"
                [(ngModel)]="calendarEventZoomMeetingNumber"
                placeholder="Ex: 98765432101"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div *ngIf="calendarEventOnline">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Code secret Zoom <span class="text-error-500">*</span></label>
              <input
                type="text"
                [(ngModel)]="calendarEventZoomPasscode"
                placeholder="Ex: CNSTN2026"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div
              *ngIf="calendarEventOnline && canInvitePartners()"
              class="sm:col-span-2 rounded-xl border border-brand-300/70 bg-brand-500/5 dark:border-brand-500/40 dark:bg-brand-500/10"
            >
              <div class="border-b border-brand-200/70 p-4 dark:border-brand-500/30">
                <div class="flex items-start gap-3">
                  <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path d="M16 7C16 8.65685 14.6569 10 13 10C11.3431 10 10 8.65685 10 7C10 5.34315 11.3431 4 13 4C14.6569 4 16 5.34315 16 7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M7 9C8.10457 9 9 8.10457 9 7C9 5.89543 8.10457 5 7 5C5.89543 5 5 5.89543 5 7C5 8.10457 5.89543 9 7 9Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M20 17V16C20 14.3431 18.6569 13 17 13H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M4 18V16.8C4 15.1431 5.34315 13.8 7 13.8H11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <div>
                    <h4 class="text-base font-semibold text-brand-700 dark:text-brand-300">Inviter des partenaires externes</h4>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Les partenaires recevront un e-mail d'invitation avec les informations de l'evenement.
                    </p>
                  </div>
                </div>
              </div>

              <div class="border-b border-brand-200/70 p-4 dark:border-brand-500/30">
                <div class="flex flex-col gap-2 sm:flex-row">
                  <input
                    [(ngModel)]="calendarPartnerInviteEmail"
                    type="email"
                    placeholder="partenaire@organisation.tn"
                    class="h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                  <button
                    type="button"
                    (click)="addCalendarPartnerEmail()"
                    class="h-11 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
                  >
                    + Ajouter
                  </button>
                </div>
              </div>

              <div class="border-b border-brand-200/70 p-4 dark:border-brand-500/30">
                <div *ngIf="calendarPartnerInvites.length === 0" class="text-sm italic text-gray-500 dark:text-gray-400">
                  Aucun partenaire ajoute
                </div>
                <div *ngIf="calendarPartnerInvites.length > 0" class="flex flex-wrap gap-2">
                  <span
                    *ngFor="let email of calendarPartnerInvites"
                    class="inline-flex items-center gap-2 rounded-full border border-brand-300 bg-white px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/40 dark:bg-gray-900 dark:text-brand-300"
                  >
                    {{ email }}
                    <button
                      type="button"
                      (click)="removeCalendarPartnerEmail(email)"
                      class="text-brand-700 transition hover:text-error-600 dark:text-brand-300 dark:hover:text-error-300"
                    >
                      x
                    </button>
                  </span>
                </div>
              </div>

              <div class="p-4">
                <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Message d'invitation personnalise</label>
                <textarea
                  [(ngModel)]="calendarPartnerInviteMessage"
                  rows="3"
                  placeholder="Bonjour, nous avons le plaisir de vous inviter a participer a notre evenement..."
                  class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                ></textarea>

                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p class="text-sm text-gray-600 dark:text-gray-300">
                    <span class="font-semibold text-brand-700 dark:text-brand-300">{{ calendarPartnerInvites.length }}</span>
                    partenaire(s) invite(s)
                  </p>
                  <button
                    type="button"
                    (click)="previewCalendarInvitation()"
                    class="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-500/10 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    Previsualiser l'invitation
                  </button>
                </div>

                <p
                  *ngIf="calendarInviteFeedback"
                  class="mt-3 text-xs"
                  [ngClass]="calendarInviteFeedbackTone === 'success' ? 'text-success-600 dark:text-success-300' : 'text-error-600 dark:text-error-300'"
                >
                  {{ calendarInviteFeedback }}
                </p>
              </div>
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Couleur visuelle</label>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  *ngFor="let entry of (calendarsEvents | keyvalue)"
                  type="button"
                  (click)="selectVisualLevel(entry.key)"
                  [ngClass]="calendarEventLevel === entry.key ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-300 dark:border-gray-700'"
                  class="flex h-11 items-center justify-center gap-2 rounded-lg border bg-white text-sm font-medium text-gray-700 transition hover:border-brand-400 dark:bg-gray-900 dark:text-gray-200"
                >
                  <span class="h-3 w-3 rounded-full" [style.backgroundColor]="entry.value"></span>
                  {{ entry.key }}
                </button>
              </div>
            </div>
          </div>

          <div *ngIf="calendarFormError" class="mt-5 rounded-lg border border-error-300 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-300">
            {{ calendarFormError }}
          </div>

          <div class="mt-6 flex flex-wrap justify-end gap-2">
            <button
              (click)="closeCalendarModal()"
              class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Annuler
            </button>
            <button
              (click)="handleAddOrUpdateCalendarEvent()"
              class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              {{ selectedEventForModal ? 'Enregistrer' : 'Ajouter evenement' }}
            </button>
          </div>
        </div>
      </div>

      <div
        *ngIf="selectedEvent"
        class="fixed inset-0 z-[110000] overflow-y-auto bg-gray-950/60 p-4 backdrop-blur-sm"
        (click)="closeEventDetails()"
      >
        <div class="flex min-h-full items-center justify-center">
          <div
            class="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
            (click)="$event.stopPropagation()"
          >
            <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white/90">{{ selectedEvent.title }}</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Detail evenement</p>
              </div>
              <button
                (click)="closeEventDetails()"
                class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Fermer
              </button>
            </div>

            <div class="mb-4 flex flex-wrap items-center gap-2">
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [ngClass]="getEventStatusBadgeClass(selectedEvent.status)">
                {{ getEventStatusLabel(selectedEvent.status) }}
              </span>
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [ngClass]="getEventTypeBadgeClass(selectedEvent.type)">
                {{ selectedEvent.type }}
              </span>
              <span
                *ngIf="selectedEvent.onlineEvent"
                class="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300"
              >
                En ligne (Zoom)
              </span>
            </div>

            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ selectedEvent.description || 'Aucune description.' }}</p>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ selectedEvent.onlineEvent ? 'Acces' : 'Lieu' }}</p>
                <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">
                  {{ selectedEvent.onlineEvent ? 'Reunion Zoom integree sur la plateforme' : selectedEvent.location }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Periode</p>
                <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">{{ getEventDateRangeLabel(selectedEvent) }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Participants</p>
                <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">{{ selectedEvent.participants.length }} / {{ selectedEvent.maxParticipants }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Organisateur</p>
                <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">{{ selectedEvent.organiserName }}</p>
              </div>
            </div>

            <div
              *ngIf="selectedEvent.onlineEvent"
              class="mt-5 rounded-xl border border-brand-300 bg-brand-500/5 p-4 dark:border-brand-500/40 dark:bg-brand-500/10"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white/90">Reunion Zoom en direct</h4>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    Les participants rejoignent ici, sans ouvrir une application externe.
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button
                    *ngIf="!zoomSessionActive"
                    (click)="joinZoomMeeting(selectedEvent)"
                    [disabled]="zoomJoinState === 'loading'"
                    class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {{ zoomJoinState === 'loading' ? 'Connexion...' : 'Rejoindre la reunion' }}
                  </button>

                  <button
                    *ngIf="zoomSessionActive"
                    (click)="leaveZoomMeeting()"
                    class="rounded-lg border border-error-500 px-4 py-2 text-sm font-semibold text-error-600 transition hover:bg-error-50 dark:text-error-300 dark:hover:bg-error-500/10"
                  >
                    Quitter la reunion
                  </button>
                </div>
              </div>

              <p *ngIf="zoomJoinError" class="mt-3 text-xs text-error-600 dark:text-error-300">
                {{ zoomJoinError }}
              </p>

              <div
                *ngIf="zoomSessionActive || zoomJoinState === 'loading'"
                [id]="zoomContainerId"
                class="mt-3 min-h-[420px] overflow-hidden rounded-xl border border-gray-200 bg-gray-950/95 dark:border-gray-700"
              ></div>

              <div
                *ngIf="!zoomSessionActive && zoomJoinState !== 'loading'"
                class="mt-3 rounded-xl border border-dashed border-gray-300 bg-white/80 px-4 py-5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300"
              >
                Lancez la reunion pour afficher Zoom integre ici. En cas de signature SDK indisponible, une ouverture Zoom Web sera proposee automatiquement.
              </div>
            </div>

            <div *ngIf="canApproveEvents() && selectedEvent.status === 'DRAFT'" class="mt-5 flex flex-wrap gap-2">
              <button
                (click)="approveEvent(selectedEvent)"
                class="rounded-lg bg-success-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-success-600"
              >
                Approuver demande
              </button>
              <button
                (click)="rejectEvent(selectedEvent)"
                class="rounded-lg bg-error-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-error-600"
              >
                Refuser demande
              </button>
            </div>

            <div *ngIf="canInvitePartners()" class="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
              <h4 class="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Inviter un partenaire externe</h4>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  [(ngModel)]="partnerInvite.name"
                  type="text"
                  placeholder="Nom partenaire"
                  class="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <input
                  [(ngModel)]="partnerInvite.email"
                  type="email"
                  placeholder="Email partenaire"
                  class="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <input
                  [(ngModel)]="partnerInvite.organization"
                  type="text"
                  placeholder="Organisation"
                  class="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 sm:col-span-2"
                />
                <textarea
                  [(ngModel)]="partnerInvite.message"
                  rows="2"
                  placeholder="Message invitation"
                  class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 sm:col-span-2"
                ></textarea>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <button
                  (click)="sendPartnerInvitation(selectedEvent)"
                  class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
                >
                  Envoyer invitation
                </button>
                <p
                  *ngIf="inviteFeedback"
                  class="text-xs"
                  [ngClass]="inviteFeedbackTone === 'success' ? 'text-success-600 dark:text-success-300' : 'text-error-600 dark:text-error-300'"
                >
                  {{ inviteFeedback }}
                </p>
              </div>
            </div>

            <div class="mt-6 flex flex-wrap justify-end gap-2">
              <button
                *ngIf="canEditEvent(selectedEvent)"
                (click)="editEvent(selectedEvent)"
                class="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Modifier evenement
              </button>
              <button
                (click)="closeEventDetails()"
                class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep {
      .fc {
        font-family: inherit;
      }

      .fc .fc-toolbar-title {
        color: #111827;
        font-size: 1.125rem;
        font-weight: 600;
      }

      .dark .fc .fc-toolbar-title {
        color: #e5e7eb;
      }

      .fc .fc-button-primary {
        background-color: #465fff;
        border-color: #465fff;
      }

      .fc .fc-button-primary:hover {
        background-color: #3641f5;
        border-color: #3641f5;
      }

      .fc .fc-button-primary.fc-button-active {
        background-color: #3641f5;
        border-color: #3641f5;
      }

      .fc-event {
        cursor: pointer;
        transition: transform 0.2s ease;
      }

      .fc-event:hover {
        transform: translateY(-1px);
      }
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class EventsListComponent implements OnInit {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  events: Event[] = [];
  selectedEvent: Event | null = null;
  viewMode: 'list' | 'calendar' = 'list';
  currentRole: AppRole = 'EMPLOYEE';
  currentUserId = 'current-user';
  currentUserName = 'Current User';

  searchTerm = '';
  statusFilter: 'all' | EventStatus = 'all';
  typeFilter: 'all' | Event['type'] = 'all';
  sortMode: EventSortMode = 'recent';

  readonly roleLabels: Record<AppRole, string> = {
    ADMIN: 'Administrateur',
    EMPLOYEE: 'Employe',
    MANAGER: 'Chef hierarchique',
    ROOM_MANAGER: 'Responsable salle',
    SECURITY_MANAGER: 'Responsable securite',
    DSN_DIRECTOR: 'Directeur DSN',
    QUALITY_MANAGER: 'Responsable qualite'
  };

  isCalendarModalOpen = false;
  selectedEventForModal: Event | null = null;
  calendarEventTitle = '';
  calendarEventDescription = '';
  calendarEventLocation = '';
  calendarEventOnline = false;
  calendarEventZoomMeetingNumber = '';
  calendarEventZoomPasscode = '';
  calendarEventType: Event['type'] = 'MEETING';
  calendarEventStatus: EventStatus = EventStatus.DRAFT;
  calendarEventMaxParticipants = 50;
  calendarEventLevel: CalendarVisualLevel = 'Primary';
  calendarEventStartDate = '';
  calendarEventEndDate = '';
  calendarFormError = '';
  calendarPartnerInviteEmail = '';
  calendarPartnerInvites: string[] = [];
  calendarPartnerInviteMessage = '';
  calendarInviteFeedback = '';
  calendarInviteFeedbackTone: CalendarInviteFeedbackTone = 'success';
  calendarSubmissionFeedback = '';
  calendarSubmissionFeedbackTone: CalendarInviteFeedbackTone = 'success';
  readonly zoomContainerId = 'zoom-meeting-embedded-root';
  zoomJoinState: 'idle' | 'loading' | 'joined' | 'error' = 'idle';
  zoomJoinError = '';
  zoomSessionActive = false;
  private zoomClient: any = null;
  private zoomSdkLoadPromise: Promise<void> | null = null;

  partnerInvite = {
    name: '',
    email: '',
    organization: '',
    message: ''
  };
  inviteFeedback = '';
  inviteFeedbackTone: 'success' | 'error' = 'success';

  eventTypeOptions: Event['type'][] = ['CONFERENCE', 'MEETING', 'TRAINING', 'WORKSHOP', 'OTHER'];
  eventStatusOptions: EventStatus[] = [
    EventStatus.DRAFT,
    EventStatus.PUBLISHED,
    EventStatus.CANCELLED,
    EventStatus.COMPLETED
  ];

  get eventTypeSelectOptions(): Option[] {
    return this.eventTypeOptions.map((type) => ({
      value: type,
      label: type,
    }));
  }

  get eventStatusSelectOptions(): Option[] {
    return this.eventStatusOptions.map((status) => ({
      value: status,
      label: this.getEventStatusLabel(status),
    }));
  }

  get statusFilterOptions(): Option[] {
    return [
      { value: 'all', label: 'Tous les statuts' },
      ...this.eventStatusSelectOptions,
    ];
  }

  get typeFilterOptions(): Option[] {
    return [
      { value: 'all', label: 'Tous les types' },
      ...this.eventTypeSelectOptions,
    ];
  }

  calendarsEvents: Record<CalendarVisualLevel, string> = {
    'Danger': '#dc2626',
    'Success': '#16a34a',
    'Primary': '#2563eb',
    'Warning': '#ea580c'
  };

  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    editable: true,
    selectable: true,
    selectMinDistance: 10,
    eventClick: (arg) => this.handleEventClick(arg),
    dateClick: (arg) => this.handleDateClick(arg),
    eventDidMount: (arg: any) => this.applyEventVisualStyles(arg),
    select: (arg) => this.handleDateSelect(arg),
    events: [],
    height: 'auto',
    contentHeight: 'auto'
  };

  constructor(
    private eventService: EventService,
    private invitationService: InvitationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (!user) {
        return;
      }

      this.currentRole = user.role;
      this.currentUserId = user.id;
      this.currentUserName = `${user.firstName} ${user.lastName}`.trim();
    });

    this.loadEvents();
  }

  get filteredEvents(): Event[] {
    let scoped = [...this.events];
    const term = this.searchTerm.trim().toLowerCase();

    if (term) {
      scoped = scoped.filter(event =>
        [
          event.title,
          event.description || '',
          event.location,
          event.organiserName,
          event.type,
          this.getEventStatusLabel(event.status)
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      );
    }

    if (this.statusFilter !== 'all') {
      scoped = scoped.filter(event => event.status === this.statusFilter);
    }

    if (this.typeFilter !== 'all') {
      scoped = scoped.filter(event => event.type === this.typeFilter);
    }

    return this.sortEvents(scoped);
  }

  get pendingEvents(): Event[] {
    return this.events.filter(event => event.status === EventStatus.DRAFT);
  }

  loadEvents(): void {
    this.eventService.getEvents().subscribe({
      next: (data) => {
        this.events = data;
        this.updateCalendarEvents();
      },
      error: (error) => console.error('Error loading events:', error)
    });
  }

  updateCalendarEvents(): void {
    const calendarEvents = this.convertEventsToCalendarFormat(this.events);
    if (this.calendarOptions.events) {
      this.calendarOptions.events = calendarEvents;
    }
    if (this.calendarComponent) {
      this.calendarComponent.getApi().refetchEvents();
    }
  }

  convertEventsToCalendarFormat(events: Event[]): EventInput[] {
    return events.map(event => {
      const visualLevel = this.getEventVisualLevel(event);
      return {
        id: event.id,
        title: event.title,
        start: event.startDate,
        end: event.endDate,
        backgroundColor: this.getLevelColor(visualLevel),
        borderColor: this.getLevelBorderColor(visualLevel),
        textColor: '#ffffff',
        extendedProps: {
          description: event.description,
          location: event.location,
          type: event.type,
          status: event.status,
          visualColor: event.visualColor,
          participants: event.participants,
          maxParticipants: event.maxParticipants,
          onlineEvent: event.onlineEvent,
          zoomMeetingNumber: event.zoomMeetingNumber
        }
      };
    });
  }

  cycleSortMode(): void {
    const sortOrder: EventSortMode[] = ['recent', 'title', 'status'];
    const currentIndex = sortOrder.indexOf(this.sortMode);
    this.sortMode = sortOrder[(currentIndex + 1) % sortOrder.length];
  }

  getSortModeLabel(): string {
    const labelMap: Record<EventSortMode, string> = {
      recent: 'recents',
      title: 'titre',
      status: 'statut'
    };
    return labelMap[this.sortMode];
  }

  getPublishedEventsCount(): number {
    return this.events.filter(event => event.status === EventStatus.PUBLISHED).length;
  }

  getReferenceMonthCount(): number {
    if (this.events.length === 0) {
      return 0;
    }

    const referenceTimestamp = Math.max(...this.events.map(event => new Date(event.startDate).getTime()));
    const referenceDate = new Date(referenceTimestamp);

    return this.events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.getFullYear() === referenceDate.getFullYear()
        && eventDate.getMonth() === referenceDate.getMonth();
    }).length;
  }

  getEventAccentClass(type: Event['type']): string {
    const classMap: Record<Event['type'], string> = {
      CONFERENCE: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      MEETING: 'bg-gradient-to-r from-violet-500 to-fuchsia-600',
      TRAINING: 'bg-gradient-to-r from-emerald-500 to-green-600',
      WORKSHOP: 'bg-gradient-to-r from-orange-500 to-red-600',
      OTHER: 'bg-gradient-to-r from-slate-500 to-gray-600'
    };
    return classMap[type];
  }

  getEventTypeBadgeClass(type: Event['type']): string {
    const classMap: Record<Event['type'], string> = {
      CONFERENCE: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      MEETING: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
      TRAINING: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      WORKSHOP: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
      OTHER: 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
    };
    return classMap[type];
  }

  getEventStatusBadgeClass(status: EventStatus): string {
    const classMap: Record<EventStatus, string> = {
      [EventStatus.PUBLISHED]: 'bg-success-500/10 text-success-700 dark:text-success-300',
      [EventStatus.DRAFT]: 'bg-warning-500/10 text-warning-700 dark:text-warning-300',
      [EventStatus.CANCELLED]: 'bg-error-500/10 text-error-700 dark:text-error-300',
      [EventStatus.COMPLETED]: 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
    };
    return classMap[status];
  }

  getEventDateRangeLabel(event: Event): string {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    const startLabel = startDate.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const endLabel = endDate.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${startLabel} - ${endLabel}`;
  }

  getParticipantFill(event: Event): number {
    const maxParticipants = event.maxParticipants || 0;
    if (maxParticipants <= 0) {
      return 0;
    }

    const fill = (event.participants.length / maxParticipants) * 100;
    return Math.min(100, Math.max(0, Math.round(fill)));
  }

  getSelectedCalendarColor(): string {
    return this.calendarsEvents[this.calendarEventLevel];
  }

  selectVisualLevel(level: string): void {
    if (this.isVisualLevel(level)) {
      this.calendarEventLevel = level;
    }
  }

  private getEventVisualLevel(event: Event): CalendarVisualLevel {
    if (event.visualColor && this.isVisualLevel(event.visualColor)) {
      return event.visualColor;
    }
    return this.mapTypeToLevel(event.type);
  }

  private getLevelColor(level: CalendarVisualLevel): string {
    return this.calendarsEvents[level];
  }

  private getLevelBorderColor(level: CalendarVisualLevel): string {
    const borderColorMap: Record<CalendarVisualLevel, string> = {
      'Danger': '#b91c1c',
      'Success': '#15803d',
      'Primary': '#1d4ed8',
      'Warning': '#c2410c'
    };
    return borderColorMap[level];
  }

  handleEventClick(clickInfo: EventClickArg): void {
    const eventId = clickInfo.event.id;
    const matchedEvent = this.events.find(event => event.id === eventId);

    if (!matchedEvent) {
      return;
    }

    if (this.viewMode === 'calendar') {
      this.selectedEventForModal = matchedEvent;
      this.calendarEventTitle = matchedEvent.title;
      this.calendarEventDescription = matchedEvent.description || '';
      this.calendarEventLocation = matchedEvent.location || '';
      this.calendarEventOnline = !!matchedEvent.onlineEvent;
      this.calendarEventZoomMeetingNumber = matchedEvent.zoomMeetingNumber || '';
      this.calendarEventZoomPasscode = matchedEvent.zoomPasscode || '';
      this.calendarEventType = matchedEvent.type || 'MEETING';
      this.calendarEventStatus = matchedEvent.status || EventStatus.DRAFT;
      this.calendarEventMaxParticipants = matchedEvent.maxParticipants || 50;
      this.calendarEventStartDate = this.formatDateForInput(new Date(matchedEvent.startDate));
      this.calendarEventEndDate = this.formatDateForInput(new Date(matchedEvent.endDate));
      this.calendarEventLevel = this.getEventVisualLevel(matchedEvent);
      this.calendarFormError = '';
      this.resetCalendarPartnerInviteState();
      this.calendarSubmissionFeedback = '';
      this.isCalendarModalOpen = true;
      return;
    }

    this.selectedEvent = matchedEvent;
    this.resetZoomJoinState();
    this.inviteFeedback = '';
  }

  handleDateClick(dateInfo: any): void {
    if (!this.canCreateEvents()) {
      return;
    }

    this.openCalendarModal(dateInfo.date, dateInfo.date);
  }

  handleDateSelect(selectInfo: DateSelectArg): void {
    if (!this.canCreateEvents()) {
      return;
    }

    const startDate = new Date(selectInfo.start);
    let endDate = selectInfo.end ? new Date(selectInfo.end) : new Date(selectInfo.start);

    if (selectInfo.allDay && selectInfo.end) {
      endDate.setDate(endDate.getDate() - 1);
    }

    if (endDate < startDate) {
      endDate = new Date(startDate);
    }

    this.openCalendarModal(startDate, endDate);
  }

  openCalendarModal(startDate?: Date, endDate?: Date): void {
    const baseStartDate = startDate || new Date();
    const baseEndDate = endDate || baseStartDate;

    this.isCalendarModalOpen = true;
    this.selectedEventForModal = null;
    this.calendarEventTitle = '';
    this.calendarEventDescription = '';
    this.calendarEventLocation = '';
    this.calendarEventOnline = false;
    this.calendarEventZoomMeetingNumber = '';
    this.calendarEventZoomPasscode = '';
    this.calendarEventType = 'MEETING';
    this.calendarEventStatus = EventStatus.DRAFT;
    this.calendarEventMaxParticipants = 50;
    this.calendarEventLevel = 'Primary';
    this.calendarEventStartDate = this.formatDateForInput(baseStartDate);
    this.calendarEventEndDate = this.formatDateForInput(baseEndDate);
    this.calendarFormError = '';
    this.resetCalendarPartnerInviteState();
    this.calendarSubmissionFeedback = '';
  }

  closeCalendarModal(): void {
    this.isCalendarModalOpen = false;
    this.selectedEventForModal = null;
    this.calendarEventTitle = '';
    this.calendarEventDescription = '';
    this.calendarEventLocation = '';
    this.calendarEventOnline = false;
    this.calendarEventZoomMeetingNumber = '';
    this.calendarEventZoomPasscode = '';
    this.calendarEventType = 'MEETING';
    this.calendarEventStatus = EventStatus.DRAFT;
    this.calendarEventMaxParticipants = 50;
    this.calendarEventLevel = 'Primary';
    this.calendarEventStartDate = '';
    this.calendarEventEndDate = '';
    this.calendarFormError = '';
    this.resetCalendarPartnerInviteState();
  }

  onCalendarOnlineModeChange(): void {
    this.clearCalendarInviteFeedback();

    if (this.calendarEventOnline) {
      return;
    }

    this.calendarEventZoomMeetingNumber = '';
    this.calendarEventZoomPasscode = '';
    this.resetCalendarPartnerInviteState();
  }

  addCalendarPartnerEmail(): void {
    if (!this.calendarEventOnline) {
      this.calendarInviteFeedbackTone = 'error';
      this.calendarInviteFeedback = 'Activez d abord le mode evenement en ligne.';
      return;
    }

    if (!this.canInvitePartners()) {
      this.calendarInviteFeedbackTone = 'error';
      this.calendarInviteFeedback = 'Votre role ne peut pas inviter des partenaires externes.';
      return;
    }

    const normalizedEmail = this.normalizePartnerEmail(this.calendarPartnerInviteEmail);
    if (!normalizedEmail) {
      this.calendarInviteFeedbackTone = 'error';
      this.calendarInviteFeedback = 'Saisissez un email partenaire valide.';
      return;
    }

    if (this.calendarPartnerInvites.includes(normalizedEmail)) {
      this.calendarInviteFeedbackTone = 'error';
      this.calendarInviteFeedback = 'Ce partenaire est deja dans la liste.';
      return;
    }

    this.calendarPartnerInvites = [...this.calendarPartnerInvites, normalizedEmail];
    this.calendarPartnerInviteEmail = '';
    this.calendarInviteFeedbackTone = 'success';
    this.calendarInviteFeedback = 'Partenaire ajoute a la liste.';
  }

  removeCalendarPartnerEmail(email: string): void {
    this.calendarPartnerInvites = this.calendarPartnerInvites.filter((item) => item !== email);
    this.calendarInviteFeedbackTone = 'success';
    this.calendarInviteFeedback = 'Partenaire retire de la liste.';
  }

  previewCalendarInvitation(): void {
    if (!this.calendarEventOnline) {
      this.calendarInviteFeedbackTone = 'error';
      this.calendarInviteFeedback = 'Le mode evenement en ligne doit etre actif pour previsualiser.';
      return;
    }

    if (this.calendarPartnerInvites.length === 0) {
      this.calendarInviteFeedbackTone = 'error';
      this.calendarInviteFeedback = 'Ajoutez au moins un partenaire avant la previsualisation.';
      return;
    }

    const previewMessage = this.resolveCalendarInviteMessage();
    this.calendarInviteFeedbackTone = 'success';
    this.calendarInviteFeedback = `Previsualisation: ${previewMessage}`;
  }

  handleAddOrUpdateCalendarEvent(): void {
    if (!this.canCreateEvents()) {
      this.calendarFormError = 'Votre role ne peut pas creer ou modifier des evenements.';
      return;
    }

    const isUpdateMode = !!this.selectedEventForModal;
    this.calendarSubmissionFeedback = '';
    this.calendarSubmissionFeedbackTone = 'success';

    const title = this.calendarEventTitle.trim();
    const location = this.calendarEventLocation.trim();
    const description = this.calendarEventDescription.trim();
    const onlineEvent = this.calendarEventOnline;
    const zoomMeetingNumber = this.calendarEventZoomMeetingNumber.trim();
    const zoomPasscode = this.calendarEventZoomPasscode.trim();
    const startDate = this.toEventDate(this.calendarEventStartDate, 'start');
    const endDate = this.toEventDate(this.calendarEventEndDate, 'end');
    const maxParticipants = Number(this.calendarEventMaxParticipants);

    if (!title) {
      this.calendarFormError = 'Le titre est obligatoire.';
      return;
    }

    if (!onlineEvent && !location) {
      this.calendarFormError = 'Le lieu est obligatoire.';
      return;
    }

    if (onlineEvent && !zoomMeetingNumber) {
      this.calendarFormError = 'L ID de reunion Zoom est obligatoire pour un evenement en ligne.';
      return;
    }

    if (onlineEvent && !zoomPasscode) {
      this.calendarFormError = 'Le code secret Zoom est obligatoire pour un evenement en ligne.';
      return;
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      this.calendarFormError = 'Veuillez selectionner des dates valides.';
      return;
    }

    if (endDate < startDate) {
      this.calendarFormError = 'La date de fin doit etre superieure ou egale a la date de debut.';
      return;
    }

    const now = new Date();
    if (startDate <= now) {
      this.calendarFormError = 'La date de debut doit etre dans le futur.';
      return;
    }

    if (!Number.isFinite(maxParticipants) || maxParticipants < 1) {
      this.calendarFormError = 'Le nombre maximal de participants doit etre au moins 1.';
      return;
    }

    if (onlineEvent && this.calendarPartnerInvites.length > 0 && !this.canInvitePartners()) {
      this.calendarFormError = 'Votre role ne peut pas inviter des partenaires externes.';
      return;
    }

    this.calendarFormError = '';
    const resolvedLocation = onlineEvent ? (location || 'En ligne (Zoom)') : location;

    const eventToSave: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
      title,
      description,
      location: resolvedLocation,
      onlineEvent,
      zoomMeetingNumber: onlineEvent ? zoomMeetingNumber : undefined,
      zoomPasscode: onlineEvent ? zoomPasscode : undefined,
      type: this.calendarEventType,
      visualColor: this.calendarEventLevel,
      status: this.canApproveEvents() ? this.calendarEventStatus : EventStatus.DRAFT,
      startDate,
      endDate,
      participants: this.selectedEventForModal?.participants || [],
      maxParticipants,
      organiserId: this.selectedEventForModal?.organiserId || this.currentUserId,
      organiserName: this.selectedEventForModal?.organiserName || this.currentUserName
    };

    const saveRequest$ = this.selectedEventForModal
      ? this.eventService.updateEvent(this.selectedEventForModal.id, eventToSave)
      : this.eventService.createEvent(eventToSave);

    saveRequest$.subscribe({
      next: (savedEvent) => {
        if (!savedEvent) {
          this.calendarFormError = 'Evenement introuvable, veuillez rafraichir puis reessayer.';
          return;
        }

        this.dispatchCalendarPartnerInvitations(savedEvent).subscribe({
          next: (dispatchResult) => {
            this.loadEvents();
            this.closeCalendarModal();
            this.calendarSubmissionFeedbackTone = dispatchResult.failedCount === 0 ? 'success' : 'error';
            this.calendarSubmissionFeedback = this.buildCalendarSubmissionFeedback(isUpdateMode, dispatchResult);
          },
          error: () => {
            this.loadEvents();
            this.closeCalendarModal();
            this.calendarSubmissionFeedbackTone = 'error';
            this.calendarSubmissionFeedback = isUpdateMode
              ? 'Evenement mis a jour, mais l envoi des invitations partenaires a echoue.'
              : 'Evenement cree, mais l envoi des invitations partenaires a echoue.';
          }
        });
      },
      error: (error) => {
        this.calendarFormError = this.extractBackendError(
          error,
          isUpdateMode
            ? 'Impossible de modifier cet evenement pour le moment.'
            : 'Impossible de creer cet evenement pour le moment.'
        );
      }
    });
  }

  getModalDateHint(): string {
    if (!this.calendarEventStartDate) {
      return 'Aucune date selectionnee';
    }

    const startLabel = this.formatDateLabel(this.calendarEventStartDate);
    if (!this.calendarEventEndDate || this.calendarEventEndDate === this.calendarEventStartDate) {
      return startLabel;
    }

    return `${startLabel} - ${this.formatDateLabel(this.calendarEventEndDate)}`;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toEventDate(dateValue: string, boundary: 'start' | 'end'): Date {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return date;
    }

    if (boundary === 'start') {
      date.setHours(9, 0, 0, 0);
    } else {
      date.setHours(18, 0, 0, 0);
    }

    return date;
  }

  private extractBackendError(error: unknown, fallbackMessage: string): string {
    const candidate = error as { error?: { detail?: string; message?: string } } | null;
    return candidate?.error?.detail || candidate?.error?.message || fallbackMessage;
  }

  private dispatchCalendarPartnerInvitations(event: Event) {
    const uniqueEmails = Array.from(new Set(
      this.calendarPartnerInvites
        .map((email) => this.normalizePartnerEmail(email))
        .filter((email): email is string => !!email)
    ));

    if (!event.onlineEvent || !this.canInvitePartners() || uniqueEmails.length === 0) {
      return of({
        sentCount: 0,
        failedCount: 0,
        failedEmails: []
      } satisfies CalendarPartnerInviteDispatchResult);
    }

    const invitationMessage = this.resolveCalendarInviteMessage(event.title);
    const inviteRequests = uniqueEmails.map((email) =>
      this.invitationService.sendInvitation({
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.startDate,
        eventLocation: event.location,
        recipientId: `${event.id}:${email}`,
        recipientEmail: email,
        recipientName: this.buildPartnerNameFromEmail(email),
        senderId: this.currentUserId,
        senderName: this.currentUserName,
        status: InvitationStatus.PENDING,
        respondedAt: undefined,
        message: invitationMessage,
        responseReason: undefined,
        isExternalPartner: true,
        isVerifiedByDsn: false,
        verifiedBy: undefined,
        verifiedAt: undefined,
        partnerOrganization: undefined
      }).pipe(
        map(() => ({ email, ok: true as const })),
        catchError(() => of({ email, ok: false as const }))
      )
    );

    return forkJoin(inviteRequests).pipe(
      map((results) => {
        const failedEmails = results.filter((result) => !result.ok).map((result) => result.email);
        return {
          sentCount: results.length - failedEmails.length,
          failedCount: failedEmails.length,
          failedEmails
        } satisfies CalendarPartnerInviteDispatchResult;
      })
    );
  }

  private buildCalendarSubmissionFeedback(
    isUpdateMode: boolean,
    dispatchResult: CalendarPartnerInviteDispatchResult
  ): string {
    const baseMessage = isUpdateMode
      ? 'Evenement mis a jour avec succes.'
      : 'Evenement cree avec succes.';

    if (dispatchResult.sentCount === 0 && dispatchResult.failedCount === 0) {
      return `${baseMessage} Aucun partenaire externe a inviter.`;
    }

    if (dispatchResult.failedCount === 0) {
      return `${baseMessage} ${dispatchResult.sentCount} invitation(s) partenaire envoyee(s).`;
    }

    const compactFailures = dispatchResult.failedEmails.slice(0, 3).join(', ');
    const suffix = dispatchResult.failedEmails.length > 3 ? ', ...' : '';
    return `${baseMessage} ${dispatchResult.sentCount} invitation(s) envoyee(s), ${dispatchResult.failedCount} echec(s): ${compactFailures}${suffix}.`;
  }

  private resolveCalendarInviteMessage(eventTitle?: string): string {
    const customMessage = this.calendarPartnerInviteMessage.trim();
    if (customMessage) {
      return customMessage;
    }

    const safeTitle = (eventTitle || this.calendarEventTitle.trim() || 'notre evenement').trim();
    const dateHint = this.calendarEventStartDate
      ? ` prevu le ${this.formatDateLabel(this.calendarEventStartDate)}`
      : '';

    return `Bonjour, nous avons le plaisir de vous inviter a participer a ${safeTitle}${dateHint}.`;
  }

  private resetCalendarPartnerInviteState(): void {
    this.calendarPartnerInviteEmail = '';
    this.calendarPartnerInvites = [];
    this.calendarPartnerInviteMessage = '';
    this.clearCalendarInviteFeedback();
  }

  private clearCalendarInviteFeedback(): void {
    this.calendarInviteFeedback = '';
    this.calendarInviteFeedbackTone = 'success';
  }

  private normalizePartnerEmail(value: string): string | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailPattern.test(normalized) ? normalized : null;
  }

  private buildPartnerNameFromEmail(email: string): string {
    const localPart = email.split('@')[0]?.trim() || '';
    const parts = localPart
      .split(/[._-]+/)
      .map((segment) => segment.trim())
      .filter((segment) => !!segment);

    if (parts.length === 0) {
      return 'Partenaire Externe';
    }

    return parts
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private formatDateLabel(dateString: string): string {
    const parsedDate = new Date(`${dateString}T00:00:00`);
    return parsedDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  private mapTypeToLevel(type: Event['type']): CalendarVisualLevel {
    if (type === 'CONFERENCE') {
      return 'Primary';
    }
    if (type === 'TRAINING') {
      return 'Success';
    }
    if (type === 'WORKSHOP') {
      return 'Danger';
    }
    return 'Warning';
  }

  private isVisualLevel(level: string): level is CalendarVisualLevel {
    return Object.prototype.hasOwnProperty.call(this.calendarsEvents, level);
  }

  private applyEventVisualStyles(arg: any): void {
    const eventId = arg?.event?.id;
    if (!eventId) {
      return;
    }

    const matchedEvent = this.events.find(event => event.id === eventId);
    if (!matchedEvent) {
      return;
    }

    const visualLevel = this.getEventVisualLevel(matchedEvent);
    const bgColor = this.getLevelColor(visualLevel);
    const borderColor = this.getLevelBorderColor(visualLevel);

    const el = arg.el as HTMLElement;
    el.style.setProperty('background-color', bgColor, 'important');
    el.style.setProperty('border-color', borderColor, 'important');
    el.style.setProperty('color', '#ffffff', 'important');

    const eventMain = el.querySelector('.fc-event-main') as HTMLElement | null;
    if (eventMain) {
      eventMain.style.setProperty('color', '#ffffff', 'important');
    }
  }

  viewEvent(event: Event): void {
    this.selectedEvent = event;
    this.resetZoomJoinState();
    this.inviteFeedback = '';
    this.inviteFeedbackTone = 'success';
  }

  editEvent(event: Event): void {
    if (!this.canEditEvent(event)) {
      return;
    }

    this.selectedEventForModal = event;
    this.calendarEventTitle = event.title;
    this.calendarEventDescription = event.description || '';
    this.calendarEventLocation = event.location || '';
    this.calendarEventOnline = !!event.onlineEvent;
    this.calendarEventZoomMeetingNumber = event.zoomMeetingNumber || '';
    this.calendarEventZoomPasscode = event.zoomPasscode || '';
    this.calendarEventType = event.type || 'MEETING';
    this.calendarEventStatus = event.status || EventStatus.DRAFT;
    this.calendarEventMaxParticipants = event.maxParticipants || 50;
    this.calendarEventStartDate = this.formatDateForInput(new Date(event.startDate));
    this.calendarEventEndDate = this.formatDateForInput(new Date(event.endDate));
    this.calendarEventLevel = this.getEventVisualLevel(event);
    this.calendarFormError = '';
    this.resetCalendarPartnerInviteState();
    this.calendarSubmissionFeedback = '';
    this.isCalendarModalOpen = true;
    this.selectedEvent = null;
    this.resetZoomJoinState();
    this.inviteFeedback = '';
    this.inviteFeedbackTone = 'success';
  }

  getEventStatusLabel(status: EventStatus): string {
    if (status === EventStatus.DRAFT) {
      return 'EN ATTENTE';
    }

    if (status === EventStatus.PUBLISHED) {
      return 'PUBLIE';
    }

    if (status === EventStatus.CANCELLED) {
      return 'ANNULE';
    }

    return 'TERMINE';
  }

  canCreateEvents(): boolean {
    return this.authService.hasPermission('CREATE_EVENT');
  }

  canApproveEvents(): boolean {
    return this.authService.hasPermission('VALIDATE_EVENT');
  }

  canInvitePartners(): boolean {
    // Accept both English and French role names
    // Directeur DSN only validates, doesn't invite partners
    return ['EMPLOYEE', 'EMPLOYE', 'MANAGER', 'CHEF_HIERARCHIQUE'].includes(this.currentRole);
  }

  canEditEvent(event: Event): boolean {
    if (this.canApproveEvents()) {
      return true;
    }

    return event.organiserId === this.currentUserId;
  }

  closeEventDetails(): void {
    if (this.zoomSessionActive) {
      void this.leaveZoomMeeting();
    } else {
      this.resetZoomJoinState();
    }
    this.selectedEvent = null;
    this.inviteFeedback = '';
    this.inviteFeedbackTone = 'success';
  }

  async joinZoomMeeting(event: Event): Promise<void> {
    if (!event.onlineEvent) {
      this.zoomJoinState = 'error';
      this.zoomJoinError = 'Cet evenement n est pas configure en mode Zoom.';
      return;
    }

    this.zoomJoinState = 'loading';
    this.zoomJoinError = '';

    const credentials = await firstValueFrom(this.eventService.getZoomMeetingCredentials(event.id));
    if (!credentials) {
      const zoomWebJoinOpened = this.openZoomWebClientFallback(event);
      if (zoomWebJoinOpened) {
        this.zoomJoinState = 'idle';
        this.zoomJoinError = 'Signature Zoom SDK indisponible. Reunion ouverte via Zoom Web.';
      } else {
        this.zoomJoinState = 'error';
        this.zoomJoinError = 'Impossible de recuperer la signature Zoom et aucun lien Zoom Web exploitable n a ete trouve.';
      }
      return;
    }

    try {
      await this.ensureZoomSdkLoaded();

      const zoomRoot = document.getElementById(this.zoomContainerId);
      if (!zoomRoot) {
        throw new Error('Zone Zoom introuvable dans la page.');
      }

      zoomRoot.innerHTML = '';

      const embeddedSdk = window.ZoomMtgEmbedded;
      if (!embeddedSdk) {
        throw new Error('Zoom SDK non charge.');
      }

      this.zoomClient = embeddedSdk.createClient();
      await this.zoomClient.init({
        zoomAppRoot: zoomRoot,
        language: 'fr-FR',
        patchJsMedia: true,
        leaveOnPageUnload: true
      });

      await this.zoomClient.join({
        signature: credentials.signature,
        sdkKey: credentials.sdkKey,
        meetingNumber: credentials.meetingNumber,
        password: credentials.passcode,
        userName: this.currentUserName || credentials.userName || 'Participant CNSTN'
      });

      this.zoomSessionActive = true;
      this.zoomJoinState = 'joined';
      this.zoomJoinError = '';
    } catch (error) {
      this.zoomJoinState = 'error';
      this.zoomSessionActive = false;
      this.zoomJoinError = this.toUserFriendlyZoomError(error);
    }
  }

  async leaveZoomMeeting(): Promise<void> {
    if (this.zoomClient && typeof this.zoomClient.leaveMeeting === 'function') {
      try {
        await this.zoomClient.leaveMeeting({});
      } catch {
        // Ignore leave errors and clean local state anyway.
      }
    }

    const zoomRoot = document.getElementById(this.zoomContainerId);
    if (zoomRoot) {
      zoomRoot.innerHTML = '';
    }

    this.zoomClient = null;
    this.resetZoomJoinState();
  }

  private ensureZoomSdkLoaded(): Promise<void> {
    if (window.ZoomMtgEmbedded) {
      return Promise.resolve();
    }

    if (this.zoomSdkLoadPromise) {
      return this.zoomSdkLoadPromise;
    }

    this.zoomSdkLoadPromise = import('@zoom/meetingsdk')
      .then((module: any) => {
        const embeddedSdk = module?.ZoomMtgEmbedded || module?.default?.ZoomMtgEmbedded;
        if (!embeddedSdk) {
          throw new Error('Module Zoom SDK indisponible.');
        }

        window.ZoomMtgEmbedded = embeddedSdk;
      });

    return this.zoomSdkLoadPromise;
  }

  private toUserFriendlyZoomError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return `Connexion Zoom echouee: ${error.message}`;
    }
    return 'Connexion Zoom echouee. Verifiez les parametres SDK et la reunion.';
  }

  private openZoomWebClientFallback(event: Event): boolean {
    const meetingNumber = event.zoomMeetingNumber?.trim();
    const passcode = event.zoomPasscode?.trim();

    if (!meetingNumber || !passcode) {
      return false;
    }

    const webJoinUrl = `https://app.zoom.us/wc/join/${encodeURIComponent(meetingNumber)}?pwd=${encodeURIComponent(passcode)}`;
    const popup = window.open(webJoinUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.assign(webJoinUrl);
    }

    return true;
  }

  private resetZoomJoinState(): void {
    this.zoomSessionActive = false;
    this.zoomJoinState = 'idle';
    this.zoomJoinError = '';
  }

  approveEvent(event: Event): void {
    if (!this.canApproveEvents()) {
      console.error('❌ User cannot approve events');
      return;
    }

    console.log(`📍 Approving event ${event.id}: ${event.title}`);
    this.eventService.changeEventStatus(event.id, EventStatus.PUBLISHED).subscribe({
      next: (updated) => {
        console.log('✅ Event approved:', updated);
        this.loadEvents();
        if (this.selectedEvent?.id === event.id) {
          this.selectedEvent = { ...event, status: EventStatus.PUBLISHED };
        }
      },
      error: (err) => {
        console.error('❌ Failed to approve event:', err);
      }
    });
  }

  rejectEvent(event: Event): void {
    if (!this.canApproveEvents()) {
      console.error('❌ User cannot reject events');
      return;
    }

    console.log(`📍 Rejecting event ${event.id}: ${event.title}`);
    this.eventService.changeEventStatus(event.id, EventStatus.CANCELLED).subscribe({
      next: (updated) => {
        console.log('✅ Event rejected:', updated);
        this.loadEvents();
        if (this.selectedEvent?.id === event.id) {
          this.selectedEvent = { ...event, status: EventStatus.CANCELLED };
        }
      },
      error: (err) => {
        console.error('❌ Failed to reject event:', err);
      }
    });
  }

  sendPartnerInvitation(event: Event): void {
    if (!this.canInvitePartners()) {
      return;
    }

    const name = this.partnerInvite.name.trim();
    const email = this.partnerInvite.email.trim().toLowerCase();

    if (!name || !email) {
      this.inviteFeedbackTone = 'error';
      this.inviteFeedback = 'Le nom et l email du partenaire sont obligatoires.';
      return;
    }

    this.invitationService.sendInvitation({
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.startDate,
      eventLocation: event.location,
      recipientId: `partner-${Date.now()}`,
      recipientEmail: email,
      recipientName: name,
      senderId: this.currentUserId,
      senderName: this.currentUserName,
      status: InvitationStatus.PENDING,
      respondedAt: undefined,
      message: this.partnerInvite.message.trim() || `Invitation partenaire envoyee par ${this.currentUserName}`,
      responseReason: undefined,
      isExternalPartner: true,
      isVerifiedByDsn: false,
      verifiedBy: undefined,
      verifiedAt: undefined,
      partnerOrganization: this.partnerInvite.organization.trim() || undefined
    }).subscribe(() => {
      this.inviteFeedbackTone = 'success';
      this.inviteFeedback = 'Invitation partenaire envoyee. En attente de verification DSN.';
      this.partnerInvite = {
        name: '',
        email: '',
        organization: '',
        message: ''
      };
    });
  }

  private sortEvents(events: Event[]): Event[] {
    const sorted = [...events];

    if (this.sortMode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
      return sorted;
    }

    if (this.sortMode === 'status') {
      sorted.sort((a, b) => this.getEventStatusLabel(a.status).localeCompare(this.getEventStatusLabel(b.status), 'fr', { sensitivity: 'base' }));
      return sorted;
    }

    sorted.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return sorted;
  }
}
