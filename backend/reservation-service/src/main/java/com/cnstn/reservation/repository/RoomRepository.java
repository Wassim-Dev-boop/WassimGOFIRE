package com.cnstn.reservation.repository;

import com.cnstn.reservation.entity.RoomEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository extends JpaRepository<RoomEntity, UUID> {
}
