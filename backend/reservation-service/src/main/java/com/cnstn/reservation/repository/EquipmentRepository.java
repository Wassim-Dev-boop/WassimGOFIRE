package com.cnstn.reservation.repository;

import com.cnstn.reservation.entity.EquipmentEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EquipmentRepository extends JpaRepository<EquipmentEntity, UUID> {
}
