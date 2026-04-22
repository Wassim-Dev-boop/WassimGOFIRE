package com.cnstn.authuser.service;

import com.cnstn.authuser.client.keycloak.KeycloakAdminClient;
import com.cnstn.authuser.client.keycloak.KeycloakCreateUserRequest;
import com.cnstn.authuser.dto.RegistrationRequest;
import com.cnstn.authuser.dto.UserResponse;
import com.cnstn.authuser.entity.RoleEntity;
import com.cnstn.authuser.entity.RoleName;
import com.cnstn.authuser.entity.UserEntity;
import com.cnstn.authuser.exception.ConflictException;
import com.cnstn.authuser.exception.ResourceNotFoundException;
import com.cnstn.authuser.mapper.UserMapper;
import com.cnstn.authuser.repository.RoleRepository;
import com.cnstn.authuser.repository.UserRepository;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RegistrationService {

    private static final int USERNAME_MAX_LENGTH = 120;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final KeycloakAdminClient keycloakAdminClient;

    public RegistrationService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            KeycloakAdminClient keycloakAdminClient
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.keycloakAdminClient = keycloakAdminClient;
    }

    @Transactional
    public UserResponse register(RegistrationRequest request) {
        String safeEmail = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(safeEmail)) {
            throw new ConflictException("Email already exists: " + safeEmail);
        }

        String safeFirstName = normalize(request.firstName());
        String safeLastName = normalize(request.lastName());
        String safePassword = normalize(request.password());
        String username = generateUniqueUsername(safeEmail, safeFirstName, safeLastName);

        RoleEntity employeeRole = roleRepository.findByName(RoleName.EMPLOYE)
                .orElseThrow(() -> new ResourceNotFoundException("Role EMPLOYE not found"));

        Set<RoleName> roleNames = Set.of(RoleName.EMPLOYE);
        UUID keycloakId = keycloakAdminClient.createUser(new KeycloakCreateUserRequest(
                username,
                safeEmail,
                safeFirstName,
                safeLastName,
                true,
                null,
                safePassword,
                false,
                false
        ), roleNames);

        try {
            UserEntity user = new UserEntity();
            user.setKeycloakId(keycloakId);
            user.setUsername(username);
            user.setEmail(safeEmail);
            user.setFirstName(safeFirstName);
            user.setLastName(safeLastName);
            user.setPhone(null);
            user.setEnabled(true);
            user.setDepartment(null);
            user.setRoles(new HashSet<>(Set.of(employeeRole)));

            return UserMapper.toResponse(userRepository.save(user));
        } catch (RuntimeException ex) {
            keycloakAdminClient.deleteUser(keycloakId);
            throw ex;
        }
    }

    private String generateUniqueUsername(String email, String firstName, String lastName) {
        String base = buildBaseUsername(email, firstName, lastName);
        String candidate = base;
        int suffix = 1;

        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            String suffixLabel = "." + suffix++;
            int allowedBaseLength = USERNAME_MAX_LENGTH - suffixLabel.length();
            String trimmedBase = base.length() > allowedBaseLength
                    ? base.substring(0, allowedBaseLength)
                    : base;
            candidate = trimmedBase + suffixLabel;
        }

        return candidate;
    }

    private String buildBaseUsername(String email, String firstName, String lastName) {
        String localPart = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
        String fromEmail = sanitizeUsername(localPart);
        if (!fromEmail.isBlank()) {
            return trimUsername(fromEmail);
        }

        String fromName = sanitizeUsername((firstName + "." + lastName).toLowerCase());
        if (!fromName.isBlank()) {
            return trimUsername(fromName);
        }

        return "user";
    }

    private String sanitizeUsername(String raw) {
        return Objects.requireNonNullElse(raw, "")
                .trim()
                .toLowerCase()
                .replaceAll("[^a-z0-9._-]", "");
    }

    private String trimUsername(String username) {
        if (username.length() <= USERNAME_MAX_LENGTH) {
            return username;
        }
        return username.substring(0, USERNAME_MAX_LENGTH);
    }

    private String normalize(String value) {
        return Objects.requireNonNullElse(value, "").trim();
    }

    private String normalizeEmail(String value) {
        return normalize(value).toLowerCase();
    }
}
