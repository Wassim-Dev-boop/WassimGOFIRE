package com.cnstn.authuser.service;

import com.cnstn.authuser.dto.DepartmentCreateRequest;
import com.cnstn.authuser.dto.DepartmentResponse;
import com.cnstn.authuser.dto.DepartmentUpdateRequest;
import com.cnstn.authuser.dto.PageResponse;
import com.cnstn.authuser.entity.DepartmentEntity;
import com.cnstn.authuser.exception.ConflictException;
import com.cnstn.authuser.exception.ResourceNotFoundException;
import com.cnstn.authuser.mapper.DepartmentMapper;
import com.cnstn.authuser.mapper.PageMapper;
import com.cnstn.authuser.repository.DepartmentRepository;
import com.cnstn.authuser.repository.UserRepository;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    public DepartmentService(DepartmentRepository departmentRepository, UserRepository userRepository) {
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<DepartmentResponse> list(Pageable pageable) {
        Page<DepartmentEntity> page = departmentRepository.findAll(Objects.requireNonNull(pageable));
        return PageMapper.fromPage(page, page.map(DepartmentMapper::toResponse).getContent());
    }

    @Transactional(readOnly = true)
    public DepartmentResponse getById(UUID id) {
        return DepartmentMapper.toResponse(fetchDepartment(Objects.requireNonNull(id)));
    }

    @Transactional
    public DepartmentResponse create(DepartmentCreateRequest request) {
        if (departmentRepository.existsByCodeIgnoreCase(request.code())) {
            throw new ConflictException("Department code already exists: " + request.code());
        }

        DepartmentEntity entity = new DepartmentEntity();
        entity.setCode(request.code().trim().toUpperCase());
        entity.setName(request.name().trim());
        entity.setDescription(request.description());
        entity.setActive(request.active() == null || request.active());

        return DepartmentMapper.toResponse(departmentRepository.save(entity));
    }

    @Transactional
    public DepartmentResponse update(UUID id, DepartmentUpdateRequest request) {
        DepartmentEntity entity = fetchDepartment(Objects.requireNonNull(id));
        entity.setName(request.name().trim());
        entity.setDescription(request.description());
        if (request.active() != null) {
            entity.setActive(request.active());
        }
        return DepartmentMapper.toResponse(departmentRepository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        DepartmentEntity entity = Objects.requireNonNull(fetchDepartment(safeId));
        long usersInDepartment = userRepository.countByDepartment_Id(safeId);

        if (usersInDepartment > 0) {
            throw new ConflictException("Department is assigned to users and cannot be deleted");
        }

        departmentRepository.delete(entity);
    }

    @Transactional(readOnly = true)
    public DepartmentEntity fetchDepartment(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        return departmentRepository.findById(safeId)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found: " + id));
    }
}
