package com.cnstn.reporting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GenericPageResponse(
        long totalElements
) {
}
