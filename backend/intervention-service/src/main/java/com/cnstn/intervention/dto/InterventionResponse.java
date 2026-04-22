package com.cnstn.intervention.dto;

import com.cnstn.intervention.entity.InterventionStatus;
import java.time.Instant;
import java.util.UUID;

public record InterventionResponse(
        UUID id,
        String title,
        String description,
        String requestedBy,
        String assignedTo,
        InterventionStatus status,
        String validationNote,
        String validatedBy,
        Instant createdAt,
        Instant updatedAt
) {
}
