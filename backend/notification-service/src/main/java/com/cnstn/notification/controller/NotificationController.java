package com.cnstn.notification.controller;

import com.cnstn.notification.dto.NotificationCreateRequest;
import com.cnstn.notification.dto.NotificationResponse;
import com.cnstn.notification.service.NotificationService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','RESPONSABLE_SALLE','RESPONSABLE_SECURITE','DIRECTEUR_DSN','RESPONSABLE_QUALITE')")
    public List<NotificationResponse> myNotifications(Principal principal) {
        return notificationService.myNotifications(principal.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTEUR_DSN','CHEF_HIERARCHIQUE')")
    public NotificationResponse create(@Valid @RequestBody NotificationCreateRequest request) {
        return notificationService.create(request);
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','RESPONSABLE_SALLE','RESPONSABLE_SECURITE','DIRECTEUR_DSN','RESPONSABLE_QUALITE')")
    public NotificationResponse markRead(@PathVariable UUID id, Principal principal) {
        return notificationService.markRead(id, principal.getName());
    }

    @GetMapping("/stream")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','RESPONSABLE_SALLE','RESPONSABLE_SECURITE','DIRECTEUR_DSN','RESPONSABLE_QUALITE')")
    public SseEmitter stream(Principal principal) {
        return notificationService.subscribe(principal.getName());
    }
}
