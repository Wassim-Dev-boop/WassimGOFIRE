package com.cnstn.intervention.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cnstn.intervention.client.notification.NotificationClient;
import com.cnstn.intervention.config.InterventionRoutingProperties;
import com.cnstn.intervention.dto.InterventionResponse;
import com.cnstn.intervention.dto.InterventionStatusUpdateRequest;
import com.cnstn.intervention.dto.InterventionUpdateRequest;
import com.cnstn.intervention.dto.InterventionValidationRequest;
import com.cnstn.intervention.entity.InterventionEntity;
import com.cnstn.intervention.entity.InterventionStatus;
import com.cnstn.intervention.exception.ConflictException;
import com.cnstn.intervention.repository.InterventionRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class InterventionServiceTest {

    @Mock
    private InterventionRepository interventionRepository;

    @Mock
    private NotificationClient notificationClient;

    @Mock
    private InterventionRoutingProperties interventionRoutingProperties;

    @InjectMocks
    private InterventionService interventionService;

    @Test
    @DisplayName("US-17.1 - employe peut modifier sa demande REQUESTED")
    void shouldUpdateOwnRequestedIntervention() {
        UUID id = UUID.randomUUID();
        InterventionEntity entity = buildEntity(id, "employe.cnstn", InterventionStatus.REQUESTED);
        when(interventionRepository.findById(id)).thenReturn(Optional.of(entity));
        when(interventionRepository.save(any(InterventionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InterventionResponse response = interventionService.updateOwnRequest(
                id,
                new InterventionUpdateRequest("Titre MAJ", "Description MAJ"),
                "employe.cnstn",
                false
        );

        assertThat(response.title()).isEqualTo("Titre MAJ");
        assertThat(response.description()).isEqualTo("Description MAJ");
    }

    @Test
    @DisplayName("US-17.3 - employe ne peut pas modifier demande d'un autre")
    void shouldDenyUpdateWhenRequesterIsDifferent() {
        UUID id = UUID.randomUUID();
        when(interventionRepository.findById(id)).thenReturn(Optional.of(buildEntity(id, "autre.user", InterventionStatus.REQUESTED)));

        assertThatThrownBy(() -> interventionService.updateOwnRequest(
                id,
                new InterventionUpdateRequest("Titre", "Description"),
                "employe.cnstn",
                false
        )).isInstanceOf(AccessDeniedException.class);

        verify(interventionRepository, never()).save(any());
    }

    @Test
    @DisplayName("US-17.2 - modification refusee si statut != REQUESTED")
    void shouldRejectUpdateWhenStatusIsNotRequested() {
        UUID id = UUID.randomUUID();
        when(interventionRepository.findById(id)).thenReturn(Optional.of(buildEntity(id, "employe.cnstn", InterventionStatus.IN_PROGRESS)));

        assertThatThrownBy(() -> interventionService.updateOwnRequest(
                id,
                new InterventionUpdateRequest("Titre", "Description"),
                "employe.cnstn",
                false
        )).isInstanceOf(ConflictException.class)
                .hasMessageContaining("REQUESTED");
    }

    @Test
    @DisplayName("US-18.1 - suppression autorisee en REQUESTED")
    void shouldDeleteOwnRequestedIntervention() {
        UUID id = UUID.randomUUID();
        InterventionEntity entity = buildEntity(id, "employe.cnstn", InterventionStatus.REQUESTED);
        when(interventionRepository.findById(id)).thenReturn(Optional.of(entity));

        interventionService.deleteOwnRequest(id, "employe.cnstn", false);

        verify(interventionRepository).delete(entity);
    }

    @Test
    @DisplayName("US-11.2 - transition invalide COMPLETED -> IN_PROGRESS")
    void shouldRejectInvalidStatusTransition() {
        UUID id = UUID.randomUUID();
        when(interventionRepository.findById(id)).thenReturn(Optional.of(buildEntity(id, "employe.cnstn", InterventionStatus.COMPLETED)));

        assertThatThrownBy(() -> interventionService.updateStatus(
                id,
                new InterventionStatusUpdateRequest(InterventionStatus.IN_PROGRESS, "tech.user"),
                "room.manager"
        )).isInstanceOf(ConflictException.class)
                .hasMessageContaining("Invalid intervention status transition");
    }

    @Test
    @DisplayName("US-11 - validation APPROVED refusee avant COMPLETED")
    void shouldRejectApprovalWhenNotCompleted() {
        UUID id = UUID.randomUUID();
        when(interventionRepository.findById(id)).thenReturn(Optional.of(buildEntity(id, "employe.cnstn", InterventionStatus.REQUESTED)));

        assertThatThrownBy(() -> interventionService.validate(
                id,
                new InterventionValidationRequest(true, "ok"),
                "room.manager"
        )).isInstanceOf(ConflictException.class)
                .hasMessageContaining("Only COMPLETED");
    }

    private InterventionEntity buildEntity(UUID id, String requestedBy, InterventionStatus status) {
        InterventionEntity entity = new InterventionEntity();
        entity.setId(id);
        entity.setTitle("Intervention");
        entity.setDescription("Description");
        entity.setRequestedBy(requestedBy);
        entity.setStatus(status);
        return entity;
    }
}
