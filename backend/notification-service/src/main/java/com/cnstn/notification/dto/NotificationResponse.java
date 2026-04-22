package com.cnstn.notification.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String recipientUsername,
        String title,
        String message,
        boolean read,
        Instant createdAt,
        Instant updatedAt
) {
}
