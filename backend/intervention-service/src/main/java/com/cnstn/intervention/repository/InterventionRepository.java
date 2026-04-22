package com.cnstn.intervention.repository;

import com.cnstn.intervention.entity.InterventionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionRepository extends JpaRepository<InterventionEntity, UUID> {
    Page<InterventionEntity> findByRequestedByIgnoreCase(String requestedBy, Pageable pageable);
}
