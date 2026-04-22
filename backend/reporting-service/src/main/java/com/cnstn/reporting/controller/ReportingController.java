package com.cnstn.reporting.controller;

import com.cnstn.reporting.dto.KpiResponse;
import com.cnstn.reporting.service.PermissionGuardService;
import com.cnstn.reporting.service.ReportingService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/kpis")
public class ReportingController {

    private static final String VIEW_REPORTS_MODULE_PERMISSION = "VIEW_REPORTS_MODULE";

    private final ReportingService reportingService;
    private final PermissionGuardService permissionGuardService;

    public ReportingController(ReportingService reportingService, PermissionGuardService permissionGuardService) {
        this.reportingService = reportingService;
        this.permissionGuardService = permissionGuardService;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTEUR_DSN','RESPONSABLE_QUALITE')")
    public KpiResponse dashboard(Authentication authentication) {
        permissionGuardService.check(authentication, VIEW_REPORTS_MODULE_PERMISSION);
        return reportingService.dashboardKpis();
    }
}
