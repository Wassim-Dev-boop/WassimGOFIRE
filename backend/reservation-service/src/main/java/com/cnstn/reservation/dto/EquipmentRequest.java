package com.cnstn.reservation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EquipmentRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 100) String serialNumber,
        @Size(max = 400) String description,
        Boolean active
) {
}
