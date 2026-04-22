package com.cnstn.event.controller;

import com.cnstn.event.dto.EventCreateRequest;
import com.cnstn.event.dto.EventDecisionRequest;
import com.cnstn.event.dto.EventResponse;
import com.cnstn.event.dto.PageResponse;
import com.cnstn.event.dto.PartnerInviteRequest;
import com.cnstn.event.dto.PartnerInviteResponse;
import com.cnstn.event.dto.ZoomSignatureResponse;
import com.cnstn.event.service.EventService;
import com.cnstn.event.service.PermissionGuardService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {

    private static final String CREATE_EVENT_PERMISSION = "CREATE_EVENT";
    private static final String VALIDATE_EVENT_PERMISSION = "VALIDATE_EVENT";

    private final EventService eventService;
    private final PermissionGuardService permissionGuardService;

    public EventController(EventService eventService, PermissionGuardService permissionGuardService) {
        this.eventService = eventService;
        this.permissionGuardService = permissionGuardService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','DIRECTEUR_DSN','RESPONSABLE_QUALITE')")
    public PageResponse<EventResponse> list(Pageable pageable) {
        return eventService.list(pageable);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','DIRECTEUR_DSN','RESPONSABLE_QUALITE')")
    public EventResponse getById(@PathVariable UUID id) {
        return eventService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('EMPLOYE','CHEF_HIERARCHIQUE','RESPONSABLE_QUALITE')")
    public EventResponse create(@Valid @RequestBody EventCreateRequest request, Principal principal, Authentication authentication) {
        permissionGuardService.check(authentication, CREATE_EVENT_PERMISSION);
        return eventService.create(request, principal.getName());
    }

    @PutMapping("/{id}/decision")
    @PreAuthorize("hasAnyRole('CHEF_HIERARCHIQUE','DIRECTEUR_DSN')")
    public EventResponse decide(
            @PathVariable UUID id,
            @Valid @RequestBody EventDecisionRequest request,
            Principal principal,
            Authentication authentication
    ) {
        permissionGuardService.check(authentication, VALIDATE_EVENT_PERMISSION);
        return eventService.decide(id, request, principal.getName());
    }

    @PostMapping("/{id}/partners")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('EMPLOYE','CHEF_HIERARCHIQUE','DIRECTEUR_DSN')")
    public PartnerInviteResponse invitePartner(@PathVariable UUID id, @Valid @RequestBody PartnerInviteRequest request) {
        return eventService.invitePartner(id, request);
    }

    @GetMapping("/{id}/partners")
    @PreAuthorize("hasAnyRole('ADMIN','CHEF_HIERARCHIQUE','DIRECTEUR_DSN')")
    public List<PartnerInviteResponse> listPartners(@PathVariable UUID id) {
        return eventService.listPartners(id);
    }

    @PostMapping("/{id}/zoom-signature")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','DIRECTEUR_DSN')")
    public ZoomSignatureResponse zoomSignature(@PathVariable UUID id, Principal principal) {
        return eventService.generateZoomSignature(id, principal.getName());
    }
}
