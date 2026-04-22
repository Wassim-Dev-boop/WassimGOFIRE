package com.cnstn.reservation.service;

import com.cnstn.reservation.client.notification.NotificationClient;
import com.cnstn.reservation.dto.ConflictCheckResponse;
import com.cnstn.reservation.dto.PageResponse;
import com.cnstn.reservation.dto.ReservationCreateRequest;
import com.cnstn.reservation.dto.ReservationResponse;
import com.cnstn.reservation.entity.EquipmentEntity;
import com.cnstn.reservation.entity.ReservationEntity;
import com.cnstn.reservation.entity.ReservationStatus;
import com.cnstn.reservation.entity.RoomEntity;
import com.cnstn.reservation.exception.BadRequestException;
import com.cnstn.reservation.exception.ResourceNotFoundException;
import com.cnstn.reservation.mapper.ReservationMapper;
import com.cnstn.reservation.repository.ReservationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReservationService {

    private static final List<ReservationStatus> BLOCKING_STATUSES = List.of(ReservationStatus.PENDING, ReservationStatus.APPROVED);
    private static final Logger log = LoggerFactory.getLogger(ReservationService.class);

    private final ReservationRepository reservationRepository;
    private final RoomService roomService;
    private final EquipmentService equipmentService;
    private final NotificationClient notificationClient;

    public ReservationService(
            ReservationRepository reservationRepository,
            RoomService roomService,
            EquipmentService equipmentService,
            NotificationClient notificationClient
    ) {
        this.reservationRepository = reservationRepository;
        this.roomService = roomService;
        this.equipmentService = equipmentService;
        this.notificationClient = notificationClient;
    }

    @Transactional(readOnly = true)
    public PageResponse<ReservationResponse> list(Pageable pageable) {
        Page<ReservationEntity> page = reservationRepository.findAll(Objects.requireNonNull(pageable));
        return new PageResponse<>(
                page.map(ReservationMapper::toResponse).getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public ReservationResponse getById(UUID id) {
        return ReservationMapper.toResponse(fetchReservation(Objects.requireNonNull(id)));
    }

    @Transactional
    public ReservationResponse create(ReservationCreateRequest request, String username) {
        if (!request.endAt().isAfter(request.startAt())) {
            throw new BadRequestException("Reservation end date must be after start date");
        }

        boolean roomRequested = request.roomId() != null;
        boolean equipmentRequested = request.equipmentId() != null;

        if (roomRequested == equipmentRequested) {
            throw new BadRequestException("Exactly one of roomId or equipmentId must be provided");
        }

        boolean conflict = hasConflict(request.roomId(), request.equipmentId(), request.startAt(), request.endAt());
        if (conflict) {
            throw new BadRequestException("Reservation conflict detected (anti-chevauchement)");
        }

        ReservationEntity entity = new ReservationEntity();
        entity.setRequesterUsername(username);
        entity.setStartAt(request.startAt());
        entity.setEndAt(request.endAt());
        entity.setPurpose(request.purpose());
        entity.setStatus(ReservationStatus.PENDING);

        if (roomRequested) {
            RoomEntity room = roomService.fetchRoom(request.roomId());
            entity.setRoom(room);
        } else {
            EquipmentEntity equipment = equipmentService.fetchEquipment(request.equipmentId());
            entity.setEquipment(equipment);
        }

        ReservationEntity saved = reservationRepository.save(entity);
        notifyReservationCreated(saved);
        return ReservationMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public ConflictCheckResponse checkConflict(UUID roomId, UUID equipmentId, Instant startAt, Instant endAt) {
        return new ConflictCheckResponse(hasConflict(roomId, equipmentId, startAt, endAt));
    }

    @Transactional
    public ReservationResponse securityValidation(UUID id, boolean approved, String securityUsername) {
        ReservationEntity entity = fetchReservation(Objects.requireNonNull(id));
        entity.setSecurityCheckedBy(securityUsername);
        entity.setStatus(approved ? ReservationStatus.APPROVED : ReservationStatus.REJECTED);
        entity.setSecurityConflict(!approved);
        ReservationEntity saved = reservationRepository.save(entity);
        notifySecurityDecision(saved, approved, securityUsername);
        return ReservationMapper.toResponse(saved);
    }

    private boolean hasConflict(UUID roomId, UUID equipmentId, Instant startAt, Instant endAt) {
        if (roomId != null) {
            return reservationRepository.existsByRoom_IdAndStatusInAndStartAtLessThanAndEndAtGreaterThan(
                    roomId,
                    BLOCKING_STATUSES,
                    endAt,
                    startAt
            );
        }

        if (equipmentId != null) {
            return reservationRepository.existsByEquipment_IdAndStatusInAndStartAtLessThanAndEndAtGreaterThan(
                    equipmentId,
                    BLOCKING_STATUSES,
                    endAt,
                    startAt
            );
        }

        throw new BadRequestException("roomId or equipmentId is required");
    }

    private ReservationEntity fetchReservation(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        return reservationRepository.findById(safeId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + id));
    }

    private void notifyReservationCreated(ReservationEntity reservation) {
        String requester = normalize(reservation.getRequesterUsername());
        if (requester.isEmpty()) {
            return;
        }

        String scope = reservation.getRoom() != null ? "salle" : "equipement";
        String title = "Reservation enregistree";
        String message = "Votre demande de reservation " + scope + " est en attente de validation securite.";

        sendNotificationSafely(requester, title, message);
    }

    private void notifySecurityDecision(ReservationEntity reservation, boolean approved, String securityUsername) {
        String requester = normalize(reservation.getRequesterUsername());
        String security = normalize(securityUsername);
        String resource = reservation.getRoom() != null
                ? "salle " + normalize(reservation.getRoom().getName())
                : "equipement " + normalize(reservation.getEquipment().getName());
        String safeResource = resource.isBlank() ? "ressource demandee" : resource;

        String requesterTitle = approved ? "Reservation approuvee" : "Reservation rejetee";
        String requesterMessage = approved
                ? "Votre reservation de " + safeResource + " a ete approuvee."
                : "Votre reservation de " + safeResource + " a ete rejetee.";
        if (!security.isEmpty()) {
            requesterMessage += " Decision prise par " + security + ".";
        }

        String securityTitle = approved ? "Validation reservation effectuee" : "Refus reservation enregistre";
        String securityMessage = approved
                ? "Vous avez approuve la reservation de " + safeResource + "."
                : "Vous avez rejete la reservation de " + safeResource + ".";
        if (!requester.isEmpty()) {
            securityMessage += " Demandeur: " + requester + ".";
        }

        sendNotificationSafely(requester, requesterTitle, requesterMessage);
        if (!security.equalsIgnoreCase(requester)) {
            sendNotificationSafely(security, securityTitle, securityMessage);
        }
    }

    private void sendNotificationSafely(String recipientUsername, String title, String message) {
        String recipient = normalize(recipientUsername);
        if (recipient.isEmpty()) {
            return;
        }

        try {
            notificationClient.sendInternalNotification(recipient, title, message);
        } catch (Exception ex) {
            log.warn("Notification dispatch failed for recipient {}", recipient, ex);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
