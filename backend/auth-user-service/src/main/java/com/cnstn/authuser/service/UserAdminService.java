package com.cnstn.authuser.service;

import com.cnstn.authuser.client.keycloak.KeycloakAdminClient;
import com.cnstn.authuser.client.keycloak.KeycloakCreateUserRequest;
import com.cnstn.authuser.client.keycloak.KeycloakUpdateUserRequest;
import com.cnstn.authuser.dto.AssignRolesRequest;
import com.cnstn.authuser.dto.PageResponse;
import com.cnstn.authuser.dto.UserCreateRequest;
import com.cnstn.authuser.dto.UserResponse;
import com.cnstn.authuser.dto.UserUpdateRequest;
import com.cnstn.authuser.entity.DepartmentEntity;
import com.cnstn.authuser.entity.RoleEntity;
import com.cnstn.authuser.entity.RoleName;
import com.cnstn.authuser.entity.UserEntity;
import com.cnstn.authuser.exception.ConflictException;
import com.cnstn.authuser.exception.ResourceNotFoundException;
import com.cnstn.authuser.mapper.PageMapper;
import com.cnstn.authuser.mapper.UserMapper;
import com.cnstn.authuser.repository.RoleRepository;
import com.cnstn.authuser.repository.UserRepository;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAdminService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentService departmentService;
    private final KeycloakAdminClient keycloakAdminClient;

    public UserAdminService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            DepartmentService departmentService,
            KeycloakAdminClient keycloakAdminClient
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentService = departmentService;
        this.keycloakAdminClient = keycloakAdminClient;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> list(Pageable pageable) {
        Page<UserEntity> page = userRepository.findAll(Objects.requireNonNull(pageable));
        return PageMapper.fromPage(page, page.map(UserMapper::toResponse).getContent());
    }

    @Transactional(readOnly = true)
    public UserResponse getById(UUID id) {
        return UserMapper.toResponse(fetchUser(Objects.requireNonNull(id)));
    }

    @Transactional
    public UserResponse create(UserCreateRequest request) {
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new ConflictException("Username already exists: " + request.username());
        }
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Email already exists: " + request.email());
        }

        DepartmentEntity department = departmentService.fetchDepartment(request.departmentId());
        Set<RoleName> normalizedRoleNames = UserPermissionPolicy.normalizeRoles(request.roles());
        Set<RoleEntity> roles = fetchRoles(normalizedRoleNames);

        UUID keycloakId = keycloakAdminClient.createUser(new KeycloakCreateUserRequest(
                request.username().trim(),
                request.email().trim().toLowerCase(),
                request.firstName().trim(),
                request.lastName().trim(),
                request.enabled() == null || request.enabled(),
                request.phone(),
                request.initialPassword(),
                true,
                true
        ), normalizedRoleNames);

        try {
            UserEntity user = new UserEntity();
            user.setKeycloakId(keycloakId);
            user.setUsername(request.username().trim());
            user.setEmail(request.email().trim().toLowerCase());
            user.setFirstName(request.firstName().trim());
            user.setLastName(request.lastName().trim());
            user.setPhone(request.phone());
            user.setEnabled(request.enabled() == null || request.enabled());
            user.setDepartment(department);
            user.setRoles(new HashSet<>(roles));
            user.setPermissionsCustomized(false);
            user.getPermissions().clear();

            return UserMapper.toResponse(userRepository.save(user));
        } catch (RuntimeException ex) {
            keycloakAdminClient.deleteUser(keycloakId);
            throw ex;
        }
    }

    @Transactional
    public UserResponse update(UUID id, UserUpdateRequest request) {
        UserEntity user = fetchUser(Objects.requireNonNull(id));

        if (!user.getEmail().equalsIgnoreCase(request.email())
                && userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Email already exists: " + request.email());
        }

        DepartmentEntity department = departmentService.fetchDepartment(request.departmentId());

        user.setEmail(request.email().trim().toLowerCase());
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPhone(request.phone());
        user.setDepartment(department);
        user.setEnabled(request.enabled());

        if (user.getKeycloakId() != null) {
            keycloakAdminClient.updateUser(user.getKeycloakId(), new KeycloakUpdateUserRequest(
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.isEnabled(),
                    user.getPhone()
            ));
        }

        return UserMapper.toResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse assignRoles(UUID id, AssignRolesRequest request) {
        UserEntity user = fetchUser(Objects.requireNonNull(id));
        Set<RoleName> normalizedRoleNames = UserPermissionPolicy.normalizeRoles(request.roles());
        Set<RoleEntity> roles = fetchRoles(normalizedRoleNames);

        user.setRoles(new HashSet<>(roles));

        if (user.getKeycloakId() != null) {
            keycloakAdminClient.setUserRealmRoles(user.getKeycloakId(), normalizedRoleNames);
        }

        return UserMapper.toResponse(userRepository.save(user));
    }

    @Transactional
    public void delete(UUID id) {
        UserEntity user = Objects.requireNonNull(fetchUser(Objects.requireNonNull(id)));

        if (user.getKeycloakId() != null) {
            keycloakAdminClient.deleteUser(user.getKeycloakId());
        }

        userRepository.delete(user);
    }

    @Transactional(readOnly = true)
    public UserEntity fetchUser(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        return userRepository.findById(safeId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }

    private Set<RoleEntity> fetchRoles(Set<RoleName> roleNames) {
        Set<RoleEntity> roles = new HashSet<>(roleRepository.findByNameIn(roleNames));
        if (roles.size() != roleNames.size()) {
            throw new ResourceNotFoundException("One or many roles are missing in local database");
        }
        return roles;
    }
}
