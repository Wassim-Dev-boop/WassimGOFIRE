package com.cnstn.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NotificationCreateRequest(
        @NotBlank @Size(max = 120) String recipientUsername,
        @NotBlank @Size(max = 180) String title,
        @NotBlank @Size(max = 2000) String message
) {
}
