package com.cnstn.event.service;

import com.cnstn.event.client.notification.NotificationClient;
import com.cnstn.event.dto.EventCreateRequest;
import com.cnstn.event.dto.EventDecisionRequest;
import com.cnstn.event.dto.EventResponse;
import com.cnstn.event.dto.PageResponse;
import com.cnstn.event.dto.PartnerInviteRequest;
import com.cnstn.event.dto.PartnerInviteResponse;
import com.cnstn.event.dto.ZoomSignatureResponse;
import com.cnstn.event.entity.EventEntity;
import com.cnstn.event.entity.EventStatus;
import com.cnstn.event.entity.PartnerInvitationEntity;
import com.cnstn.event.exception.BadRequestException;
import com.cnstn.event.exception.ResourceNotFoundException;
import com.cnstn.event.mapper.EventMapper;
import com.cnstn.event.repository.EventRepository;
import com.cnstn.event.repository.PartnerInvitationRepository;
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
public class EventService {

    private static final Logger log = LoggerFactory.getLogger(EventService.class);

    private final EventRepository eventRepository;
    private final PartnerInvitationRepository partnerInvitationRepository;
    private final ZoomSignatureService zoomSignatureService;
    private final NotificationClient notificationClient;

    public EventService(
            EventRepository eventRepository,
            PartnerInvitationRepository partnerInvitationRepository,
            ZoomSignatureService zoomSignatureService,
            NotificationClient notificationClient
    ) {
        this.eventRepository = eventRepository;
        this.partnerInvitationRepository = partnerInvitationRepository;
        this.zoomSignatureService = zoomSignatureService;
        this.notificationClient = notificationClient;
    }

    @Transactional(readOnly = true)
    public PageResponse<EventResponse> list(Pageable pageable) {
        Page<EventEntity> page = eventRepository.findAll(Objects.requireNonNull(pageable));
        return new PageResponse<>(
                page.map(EventMapper::toResponse).getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public EventResponse getById(UUID id) {
        return EventMapper.toResponse(fetchEvent(Objects.requireNonNull(id)));
    }

    @Transactional
    public EventResponse create(EventCreateRequest request, String username) {
        if (!request.endAt().isAfter(request.startAt())) {
            throw new BadRequestException("Event end date must be after start date");
        }

        boolean onlineEvent = Boolean.TRUE.equals(request.onlineEvent());
        String location = normalize(request.location());
        String zoomMeetingNumber = normalize(request.zoomMeetingNumber());
        String zoomPasscode = normalize(request.zoomPasscode());

        if (onlineEvent) {
            if (zoomMeetingNumber.isEmpty()) {
                throw new BadRequestException("Zoom meeting number is required for online events");
            }
            if (zoomPasscode.isEmpty()) {
                throw new BadRequestException("Zoom passcode is required for online events");
            }

            if (location.isEmpty()) {
                location = "En ligne (Zoom)";
            }
        } else {
            if (location.isEmpty()) {
                throw new BadRequestException("Event location is required for on-site events");
            }
            zoomMeetingNumber = null;
            zoomPasscode = null;
        }

        EventEntity entity = new EventEntity();
        entity.setTitle(request.title().trim());
        entity.setDescription(normalizeOrNull(request.description()));
        entity.setStartAt(request.startAt());
        entity.setEndAt(request.endAt());
        entity.setLocation(location);
        entity.setOnlineEvent(onlineEvent);
        entity.setZoomMeetingNumber(zoomMeetingNumber);
        entity.setZoomPasscode(zoomPasscode);
        entity.setRequestedBy(username);
        entity.setStatus(EventStatus.PENDING);

        return EventMapper.toResponse(eventRepository.save(entity));
    }

    @Transactional
    public EventResponse decide(UUID id, EventDecisionRequest request, String decidedBy) {
        EventEntity event = fetchEvent(Objects.requireNonNull(id));
        boolean approved = Boolean.TRUE.equals(request.approved());
        event.setStatus(approved ? EventStatus.APPROVED : EventStatus.REJECTED);
        event.setDecisionComment(request.decisionComment());
        event.setDecidedBy(decidedBy);
        EventEntity saved = eventRepository.save(event);
        notifyDecisionActors(saved, approved, decidedBy, request.decisionComment());
        return EventMapper.toResponse(saved);
    }

    @Transactional
    public PartnerInviteResponse invitePartner(UUID eventId, PartnerInviteRequest request) {
        EventEntity event = fetchEvent(Objects.requireNonNull(eventId));

        PartnerInvitationEntity invitation = new PartnerInvitationEntity();
        invitation.setEvent(event);
        invitation.setPartnerName(request.partnerName().trim());
        invitation.setPartnerEmail(request.partnerEmail().trim().toLowerCase());
        PartnerInvitationEntity saved = partnerInvitationRepository.save(invitation);

        String partnerName = normalize(saved.getPartnerName());
        String partnerEmail = normalize(saved.getPartnerEmail());
        String eventTitle = normalize(event.getTitle());
        String safeEventTitle = eventTitle.isEmpty() ? "Evenement CNSTN" : eventTitle;
        String location = normalize(event.getLocation());
        String safeLocation = location.isEmpty() ? "A definir" : location;

        String subject = "Invitation - " + safeEventTitle;
        String body = "Bonjour " + (partnerName.isEmpty() ? "Partenaire" : partnerName) + ",\n\n"
                + "Vous etes invite a l evenement: " + safeEventTitle + "\n"
                + "Debut: " + event.getStartAt() + "\n"
                + "Fin: " + event.getEndAt() + "\n"
                + "Lieu: " + safeLocation + "\n";

        if (Boolean.TRUE.equals(event.getOnlineEvent())) {
            String meetingNumber = normalize(event.getZoomMeetingNumber());
            String passcode = normalize(event.getZoomPasscode());
            if (!meetingNumber.isEmpty()) {
                body += "Zoom meeting: " + meetingNumber + "\n";
            }
            if (!passcode.isEmpty()) {
                body += "Zoom passcode: " + passcode + "\n";
            }
        }

        body += "\nCordialement,\nEquipe CNSTN";

        notificationClient.sendInternalEmail(partnerEmail, subject, body, false);

        return EventMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PartnerInviteResponse> listPartners(UUID eventId) {
        UUID safeEventId = Objects.requireNonNull(eventId);
        fetchEvent(safeEventId);
        return partnerInvitationRepository.findByEventId(safeEventId)
                .stream()
                .map(EventMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ZoomSignatureResponse generateZoomSignature(UUID eventId, String userName) {
        EventEntity event = fetchEvent(Objects.requireNonNull(eventId));

        if (!Boolean.TRUE.equals(event.getOnlineEvent())) {
            throw new BadRequestException("This event is not configured as an online Zoom event");
        }

        String meetingNumber = normalize(event.getZoomMeetingNumber());
        String passcode = normalize(event.getZoomPasscode());
        if (meetingNumber.isEmpty() || passcode.isEmpty()) {
            throw new BadRequestException("Zoom meeting configuration is incomplete for this event");
        }

        int role = 0;
        String signature = zoomSignatureService.generateSignature(meetingNumber, role);
        String safeUserName = normalize(userName);
        if (safeUserName.isEmpty()) {
            safeUserName = "Participant CNSTN";
        }

        return new ZoomSignatureResponse(
                zoomSignatureService.getSdkKey(),
                signature,
                meetingNumber,
                passcode,
                safeUserName,
                role
        );
    }

    private EventEntity fetchEvent(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        return eventRepository.findById(safeId)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + id));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeOrNull(String value) {
        String normalized = normalize(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private void notifyDecisionActors(EventEntity event, boolean approved, String decidedBy, String decisionComment) {
        String eventTitle = normalize(event.getTitle());
        String safeEventTitle = eventTitle.isEmpty() ? "Evenement sans titre" : eventTitle;
        String requester = normalize(event.getRequestedBy());
        String decider = normalize(decidedBy);
        String comment = normalize(decisionComment);

        String requesterTitle = approved ? "Evenement approuve" : "Evenement refuse";
        String requesterMessage = approved
                ? "Votre evenement \"" + safeEventTitle + "\" a ete approuve."
                : "Votre evenement \"" + safeEventTitle + "\" a ete refuse.";
        if (!decider.isEmpty()) {
            requesterMessage += " Decision prise par " + decider + ".";
        }
        if (!comment.isEmpty()) {
            requesterMessage += " Commentaire: " + comment;
        }

        String deciderTitle = approved ? "Validation effectuee" : "Refus enregistre";
        String deciderMessage = approved
                ? "Vous avez approuve l evenement \"" + safeEventTitle + "\"."
                : "Vous avez refuse l evenement \"" + safeEventTitle + "\".";
        if (!requester.isEmpty()) {
            deciderMessage += " Demandeur: " + requester + ".";
        }

        sendNotificationSafely(requester, requesterTitle, requesterMessage);
        if (!decider.equalsIgnoreCase(requester)) {
            sendNotificationSafely(decider, deciderTitle, deciderMessage);
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
}
