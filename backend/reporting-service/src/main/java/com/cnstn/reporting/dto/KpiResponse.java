package com.cnstn.reporting.dto;

public record KpiResponse(
        long totalEvents,
        long totalReservations,
        long totalInterventions,
        long totalDocuments
) {
}
