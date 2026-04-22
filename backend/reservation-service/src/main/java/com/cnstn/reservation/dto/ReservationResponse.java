package com.cnstn.reservation.dto;

import com.cnstn.reservation.entity.ReservationStatus;
import java.time.Instant;
import java.util.UUID;

public record ReservationResponse(
        UUID id,
        UUID roomId,
        UUID equipmentId,
        String requesterUsername,
        Instant startAt,
        Instant endAt,
        String purpose,
        ReservationStatus status,
        boolean securityConflict,
        String securityCheckedBy,
        Instant createdAt,
        Instant updatedAt
) {
}
