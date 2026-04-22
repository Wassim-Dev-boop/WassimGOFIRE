package com.cnstn.ged.controller;

import com.cnstn.ged.dto.DocumentCreateRequest;
import com.cnstn.ged.dto.DocumentResponse;
import com.cnstn.ged.dto.PageResponse;
import com.cnstn.ged.service.DocumentService;
import com.cnstn.ged.service.PermissionGuardService;
import jakarta.validation.Valid;
import java.security.Principal;
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
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private static final String PUBLISH_DOCUMENT_PERMISSION = "PUBLISH_DOCUMENT";

    private final DocumentService documentService;
    private final PermissionGuardService permissionGuardService;

    public DocumentController(DocumentService documentService, PermissionGuardService permissionGuardService) {
        this.documentService = documentService;
        this.permissionGuardService = permissionGuardService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','RESPONSABLE_QUALITE','DIRECTEUR_DSN','RESPONSABLE_SALLE','RESPONSABLE_SECURITE')")
    public PageResponse<DocumentResponse> list(Pageable pageable) {
        return documentService.list(pageable);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EMPLOYE','CHEF_HIERARCHIQUE','RESPONSABLE_QUALITE','DIRECTEUR_DSN','RESPONSABLE_SALLE','RESPONSABLE_SECURITE')")
    public DocumentResponse getById(@PathVariable UUID id) {
        return documentService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public DocumentResponse create(
            @Valid @RequestBody DocumentCreateRequest request,
            Principal principal,
            Authentication authentication
    ) {
        permissionGuardService.check(authentication, PUBLISH_DOCUMENT_PERMISSION);
        return documentService.create(request, principal.getName());
    }

    @PutMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('EMPLOYE','CHEF_HIERARCHIQUE')")
    public DocumentResponse submit(@PathVariable UUID id) {
        return documentService.submitWorkflow(id);
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public DocumentResponse approve(@PathVariable UUID id, Principal principal) {
        return documentService.approve(id, principal.getName());
    }

    @PutMapping("/{id}/publish")
    @PreAuthorize("hasRole('RESPONSABLE_QUALITE')")
    public DocumentResponse publish(@PathVariable UUID id, Principal principal, Authentication authentication) {
        permissionGuardService.check(authentication, PUBLISH_DOCUMENT_PERMISSION);
        return documentService.publish(id, principal.getName());
    }
}
