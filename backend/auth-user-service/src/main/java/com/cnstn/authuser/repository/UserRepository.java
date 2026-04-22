package com.cnstn.authuser.repository;

import com.cnstn.authuser.entity.UserEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.lang.NonNull;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    @Override
    @EntityGraph(attributePaths = {"roles", "department", "permissions"})
    @NonNull Page<UserEntity> findAll(@NonNull Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"roles", "department", "permissions"})
    @NonNull Optional<UserEntity> findById(@NonNull UUID id);

    @EntityGraph(attributePaths = {"roles", "department", "permissions"})
    Optional<UserEntity> findByUsernameIgnoreCase(String username);

    @EntityGraph(attributePaths = {"roles", "department", "permissions"})
    Optional<UserEntity> findByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    long countByDepartment_Id(UUID departmentId);
}
