package com.cnstn.authuser.controller;

import com.cnstn.authuser.dto.DepartmentCreateRequest;
import com.cnstn.authuser.dto.DepartmentResponse;
import com.cnstn.authuser.dto.DepartmentUpdateRequest;
import com.cnstn.authuser.dto.PageResponse;
import com.cnstn.authuser.service.DepartmentService;
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
@RequestMapping("/api/v1/admin/departments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDepartmentController {

    private final DepartmentService departmentService;

    public AdminDepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public PageResponse<DepartmentResponse> list(Pageable pageable) {
        return departmentService.list(pageable);
    }

    @GetMapping("/{id}")
    public DepartmentResponse getById(@PathVariable UUID id) {
        return departmentService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentResponse create(@Valid @RequestBody DepartmentCreateRequest request) {
        return departmentService.create(request);
    }

    @PutMapping("/{id}")
    public DepartmentResponse update(@PathVariable UUID id, @Valid @RequestBody DepartmentUpdateRequest request) {
        return departmentService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        departmentService.delete(id);
    }
}
