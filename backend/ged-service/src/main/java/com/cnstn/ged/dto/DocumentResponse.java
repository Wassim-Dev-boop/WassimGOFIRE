package com.cnstn.ged.dto;

import com.cnstn.ged.entity.DocumentStatus;
import java.time.Instant;
import java.util.UUID;

public record DocumentResponse(
        UUID id,
        String title,
        String category,
        String subCategory,
        String content,
        String createdBy,
        DocumentStatus status,
        String approvedBy,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
