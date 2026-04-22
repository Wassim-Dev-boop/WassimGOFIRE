package com.cnstn.notification.service;

import com.cnstn.notification.dto.NotificationCreateRequest;
import com.cnstn.notification.dto.NotificationResponse;
import com.cnstn.notification.entity.NotificationEntity;
import com.cnstn.notification.exception.InvalidInternalApiKeyException;
import com.cnstn.notification.exception.ResourceNotFoundException;
import com.cnstn.notification.mapper.NotificationMapper;
import com.cnstn.notification.repository.NotificationRepository;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final String internalApiKey;
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    public NotificationService(
            NotificationRepository notificationRepository,
            @Value("${app.internal.api-key:change-me}") String internalApiKey
    ) {
        this.notificationRepository = notificationRepository;
        this.internalApiKey = internalApiKey;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> myNotifications(String username) {
        return notificationRepository.findByRecipientUsernameIgnoreCaseOrderByCreatedAtDesc(username)
                .stream()
                .map(NotificationMapper::toResponse)
                .toList();
    }

    @Transactional
    public NotificationResponse create(NotificationCreateRequest request) {
        return createNotification(request);
    }

    @Transactional
    public NotificationResponse createInternal(String providedApiKey, NotificationCreateRequest request) {
        if (providedApiKey == null || !Objects.equals(internalApiKey, providedApiKey)) {
            throw new InvalidInternalApiKeyException();
        }

        return createNotification(request);
    }

    private NotificationResponse createNotification(NotificationCreateRequest request) {
        NotificationEntity notification = new NotificationEntity();
        notification.setRecipientUsername(request.recipientUsername().trim());
        notification.setTitle(request.title().trim());
        notification.setMessage(request.message().trim());

        NotificationEntity saved = notificationRepository.save(notification);
        pushRealtime(saved);
        return NotificationMapper.toResponse(saved);
    }

    @Transactional
    public NotificationResponse markRead(UUID id, String username) {
        NotificationEntity notification = notificationRepository.findById(Objects.requireNonNull(id))
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));

        if (!notification.getRecipientUsername().equalsIgnoreCase(username)) {
            throw new ResourceNotFoundException("Notification not found for current user");
        }

        notification.setReadFlag(true);
        return NotificationMapper.toResponse(notificationRepository.save(notification));
    }

    public SseEmitter subscribe(String username) {
        SseEmitter emitter = new SseEmitter(0L);
        subscribers.computeIfAbsent(username.toLowerCase(), ignored -> new CopyOnWriteArrayList<>())
                .add(emitter);

        emitter.onCompletion(() -> removeEmitter(username, emitter));
        emitter.onTimeout(() -> removeEmitter(username, emitter));
        emitter.onError(error -> removeEmitter(username, emitter));

        return emitter;
    }

    private void pushRealtime(NotificationEntity notification) {
        String username = notification.getRecipientUsername().toLowerCase();
        List<SseEmitter> emitters = subscribers.getOrDefault(username, new CopyOnWriteArrayList<>());

        NotificationResponse payload = NotificationMapper.toResponse(notification);
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("notification").data(Objects.requireNonNull(payload)));
            } catch (IOException ex) {
                emitter.completeWithError(ex);
                removeEmitter(username, emitter);
            }
        }
    }

    private void removeEmitter(String username, SseEmitter emitter) {
        subscribers.computeIfPresent(username.toLowerCase(), (key, list) -> {
            list.remove(emitter);
            return list.isEmpty() ? null : list;
        });
    }
}
