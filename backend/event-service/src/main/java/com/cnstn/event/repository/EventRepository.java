package com.cnstn.event.repository;

import com.cnstn.event.entity.EventEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<EventEntity, UUID> {
}
