package com.cnstn.reservation.repository;

import com.cnstn.reservation.entity.ReservationEntity;
import com.cnstn.reservation.entity.ReservationStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationRepository extends JpaRepository<ReservationEntity, UUID> {

    boolean existsByRoom_IdAndStatusInAndStartAtLessThanAndEndAtGreaterThan(
            UUID roomId,
            Collection<ReservationStatus> statuses,
            Instant endAt,
            Instant startAt
    );

    boolean existsByEquipment_IdAndStatusInAndStartAtLessThanAndEndAtGreaterThan(
            UUID equipmentId,
            Collection<ReservationStatus> statuses,
            Instant endAt,
            Instant startAt
    );
}
