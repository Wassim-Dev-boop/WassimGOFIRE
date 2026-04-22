package com.cnstn.authuser.controller;

import com.cnstn.authuser.dto.PageResponse;
import com.cnstn.authuser.dto.RoleCreateRequest;
import com.cnstn.authuser.dto.RoleResponse;
import com.cnstn.authuser.dto.RoleUpdateRequest;
import com.cnstn.authuser.service.RoleService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/roles")
@PreAuthorize("hasRole('ADMIN')")
public class AdminRoleController {

    private final RoleService roleService;

    public AdminRoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    public PageResponse<RoleResponse> list(Pageable pageable) {
        return roleService.list(pageable);
    }

    @GetMapping("/{id}")
    public RoleResponse getById(@PathVariable UUID id) {
        return roleService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoleResponse create(@Valid @RequestBody RoleCreateRequest request) {
        return roleService.create(request);
    }

    @PutMapping("/{id}")
    public RoleResponse update(@PathVariable UUID id, @Valid @RequestBody RoleUpdateRequest request) {
        return roleService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        roleService.delete(id);
    }
}
