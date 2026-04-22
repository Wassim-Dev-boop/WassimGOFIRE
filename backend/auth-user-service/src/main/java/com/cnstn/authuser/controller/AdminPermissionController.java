package com.cnstn.authuser.controller;

import com.cnstn.authuser.dto.PermissionDefinitionResponse;
import com.cnstn.authuser.service.UserPermissionService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/permissions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPermissionController {

    private final UserPermissionService userPermissionService;

    public AdminPermissionController(UserPermissionService userPermissionService) {
        this.userPermissionService = userPermissionService;
    }

    @GetMapping("/catalog")
    public List<PermissionDefinitionResponse> catalog() {
        return userPermissionService.listCatalog();
    }
}
