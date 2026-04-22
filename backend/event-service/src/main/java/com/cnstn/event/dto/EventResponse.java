package com.cnstn.event.dto;

import com.cnstn.event.entity.EventStatus;
import java.time.Instant;
import java.util.UUID;

public record EventResponse(
        UUID id,
        String title,
        String description,
        Instant startAt,
        Instant endAt,
        String location,
        Boolean onlineEvent,
        String zoomMeetingNumber,
        String zoomPasscode,
        String requestedBy,
        EventStatus status,
        String decisionComment,
        String decidedBy,
        Instant createdAt,
        Instant updatedAt
) {
}
