package com.cnstn.authuser.controller;

import com.cnstn.authuser.dto.UserPermissionsResponse;
import com.cnstn.authuser.dto.UserPermissionsUpdateRequest;
import com.cnstn.authuser.service.UserPermissionService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/users/{id}/permissions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserPermissionController {

    private final UserPermissionService userPermissionService;

    public AdminUserPermissionController(UserPermissionService userPermissionService) {
        this.userPermissionService = userPermissionService;
    }

    @GetMapping
    public UserPermissionsResponse getUserPermissions(@PathVariable UUID id) {
        return userPermissionService.getUserPermissions(id);
    }

    @PutMapping
    public UserPermissionsResponse updateUserPermissions(
            @PathVariable UUID id,
            @Valid @RequestBody UserPermissionsUpdateRequest request
    ) {
        return userPermissionService.updateUserPermissions(id, request.permissionCodes());
    }

    @DeleteMapping
    public UserPermissionsResponse resetUserPermissions(@PathVariable UUID id) {
        return userPermissionService.resetUserPermissions(id);
    }
}
