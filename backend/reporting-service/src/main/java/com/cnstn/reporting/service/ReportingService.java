package com.cnstn.reporting.service;

import com.cnstn.reporting.client.EventClient;
import com.cnstn.reporting.client.GedClient;
import com.cnstn.reporting.client.InterventionClient;
import com.cnstn.reporting.client.ReservationClient;
import com.cnstn.reporting.dto.GenericPageResponse;
import com.cnstn.reporting.dto.KpiResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ReportingService {

    private static final Logger LOG = LoggerFactory.getLogger(ReportingService.class);

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

    @CircuitBreaker(name = "kpiAggregator")
    public KpiResponse dashboardKpis() {
        long events = safeCount("events", () -> eventClient.count(0, 1));
        long reservations = safeCount("reservations", () -> reservationClient.count(0, 1));
        long interventions = safeCount("interventions", () -> interventionClient.count(0, 1));
        long documents = safeCount("documents", () -> gedClient.count(0, 1));

        return new KpiResponse(events, reservations, interventions, documents);
    }

    private long safeCount(String source, Supplier<GenericPageResponse> supplier) {
        try {
            return safeTotal(supplier.get());
        } catch (Exception ex) {
            LOG.warn("KPI source '{}' unavailable, fallback to 0: {}", source, ex.getMessage());
            return 0;
        }
    }

    private long safeTotal(GenericPageResponse response) {
        return response == null ? 0 : response.totalElements();
    }
}
