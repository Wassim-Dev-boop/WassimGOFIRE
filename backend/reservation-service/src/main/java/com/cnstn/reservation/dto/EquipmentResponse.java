package com.cnstn.reservation.dto;

import java.time.Instant;
import java.util.UUID;

public record EquipmentResponse(
        UUID id,
        String name,
        String serialNumber,
        String description,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {
}
