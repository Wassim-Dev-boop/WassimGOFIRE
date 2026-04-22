package com.cnstn.ged.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DocumentCreateRequest(
        @NotBlank @Size(max = 180) String title,
        @NotBlank @Size(max = 120) String category,
        @Size(max = 80) String subCategory,
        @NotBlank @Size(max = 10000) String content
) {
}
