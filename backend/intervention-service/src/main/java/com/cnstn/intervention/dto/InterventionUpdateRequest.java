package com.cnstn.intervention.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InterventionUpdateRequest(
        @NotBlank @Size(max = 150) String title,
        @NotBlank @Size(max = 1000) String description
) {
}
