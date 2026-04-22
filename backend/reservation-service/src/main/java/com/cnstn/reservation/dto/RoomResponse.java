package com.cnstn.reservation.dto;

import java.time.Instant;
import java.util.UUID;

public record RoomResponse(
        UUID id,
        String name,
        String location,
        int capacity,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {
}
