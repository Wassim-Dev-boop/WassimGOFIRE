package com.cnstn.authuser.repository;

import com.cnstn.authuser.entity.DepartmentEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository extends JpaRepository<DepartmentEntity, UUID> {

    boolean existsByCodeIgnoreCase(String code);

    Optional<DepartmentEntity> findByCodeIgnoreCase(String code);
}
