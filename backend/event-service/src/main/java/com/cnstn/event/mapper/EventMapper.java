package com.cnstn.event.mapper;

import com.cnstn.event.dto.EventResponse;
import com.cnstn.event.dto.PartnerInviteResponse;
import com.cnstn.event.entity.EventEntity;
import com.cnstn.event.entity.PartnerInvitationEntity;

public final class EventMapper {

    private EventMapper() {
    }

    public static EventResponse toResponse(EventEntity entity) {
        return new EventResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getStartAt(),
                entity.getEndAt(),
                entity.getLocation(),
                entity.getOnlineEvent(),
                entity.getZoomMeetingNumber(),
                entity.getZoomPasscode(),
                entity.getRequestedBy(),
                entity.getStatus(),
                entity.getDecisionComment(),
                entity.getDecidedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public static PartnerInviteResponse toResponse(PartnerInvitationEntity entity) {
        return new PartnerInviteResponse(
                entity.getId(),
                entity.getEvent().getId(),
                entity.getPartnerName(),
                entity.getPartnerEmail(),
                entity.isAccessApproved(),
                entity.getCreatedAt()
        );
    }
}
