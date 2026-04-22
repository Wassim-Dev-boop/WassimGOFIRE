package com.cnstn.reservation.dto;

import jakarta.validation.constraints.NotNull;

public record SecurityValidationRequest(
        @NotNull Boolean approved
) {
}
