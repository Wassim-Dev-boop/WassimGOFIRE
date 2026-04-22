package com.cnstn.notification.repository;

import com.cnstn.notification.entity.NotificationEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {

    List<NotificationEntity> findByRecipientUsernameIgnoreCaseOrderByCreatedAtDesc(String username);
}
