package com.cnstn.event.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "events")
public class EventEntity {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "title", nullable = false, length = 150)
    private String title;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "location", length = 150)
    private String location;

    @Column(name = "online_event")
    private Boolean onlineEvent = Boolean.FALSE;

    @Column(name = "zoom_meeting_number", length = 30)
    private String zoomMeetingNumber;

    @Column(name = "zoom_passcode", length = 100)
    private String zoomPasscode;

    @Column(name = "requested_by", nullable = false, length = 120)
    private String requestedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private EventStatus status = EventStatus.PENDING;

    @Column(name = "decision_comment", length = 500)
    private String decisionComment;

    @Column(name = "decided_by", length = 120)
    private String decidedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "event")
    private Set<PartnerInvitationEntity> partnerInvitations = new HashSet<>();

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public void setStartAt(Instant startAt) {
        this.startAt = startAt;
    }

    public Instant getEndAt() {
        return endAt;
    }

    public void setEndAt(Instant endAt) {
        this.endAt = endAt;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Boolean getOnlineEvent() {
        return onlineEvent;
    }

    public void setOnlineEvent(Boolean onlineEvent) {
        this.onlineEvent = onlineEvent;
    }

    public String getZoomMeetingNumber() {
        return zoomMeetingNumber;
    }

    public void setZoomMeetingNumber(String zoomMeetingNumber) {
        this.zoomMeetingNumber = zoomMeetingNumber;
    }

    public String getZoomPasscode() {
        return zoomPasscode;
    }

    public void setZoomPasscode(String zoomPasscode) {
        this.zoomPasscode = zoomPasscode;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public EventStatus getStatus() {
        return status;
    }

    public void setStatus(EventStatus status) {
        this.status = status;
    }

    public String getDecisionComment() {
        return decisionComment;
    }

    public void setDecisionComment(String decisionComment) {
        this.decisionComment = decisionComment;
    }

    public String getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(String decidedBy) {
        this.decidedBy = decidedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Set<PartnerInvitationEntity> getPartnerInvitations() {
        return partnerInvitations;
    }

    public void setPartnerInvitations(Set<PartnerInvitationEntity> partnerInvitations) {
        this.partnerInvitations = partnerInvitations;
    }
}
