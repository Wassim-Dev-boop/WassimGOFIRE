package com.cnstn.reporting.service;

import com.cnstn.reporting.client.EventClient;
import com.cnstn.reporting.client.GedClient;
import com.cnstn.reporting.client.InterventionClient;
import com.cnstn.reporting.client.ReservationClient;
import com.cnstn.reporting.dto.GenericPageResponse;
import com.cnstn.reporting.dto.KpiResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.springframework.stereotype.Service;

@Service
public class ReportingService {

    private final EventClient eventClient;
    private final ReservationClient reservationClient;
    private final InterventionClient interventionClient;
    private final GedClient gedClient;

    public ReportingService(
            EventClient eventClient,
            ReservationClient reservationClient,
            InterventionClient interventionClient,
            GedClient gedClient
    ) {
        this.eventClient = eventClient;
        this.reservationClient = reservationClient;
        this.interventionClient = interventionClient;
        this.gedClient = gedClient;
    }

    @CircuitBreaker(name = "kpiAggregator", fallbackMethod = "fallbackKpis")
    public KpiResponse dashboardKpis() {
        long events = safeTotal(eventClient.count(0, 1));
        long reservations = safeTotal(reservationClient.count(0, 1));
        long interventions = safeTotal(interventionClient.count(0, 1));
        long documents = safeTotal(gedClient.count(0, 1));

        return new KpiResponse(events, reservations, interventions, documents);
    }

    public KpiResponse fallbackKpis(Throwable throwable) {
        return new KpiResponse(0, 0, 0, 0);
    }

    private long safeTotal(GenericPageResponse response) {
        return response == null ? 0 : response.totalElements();
    }
}
