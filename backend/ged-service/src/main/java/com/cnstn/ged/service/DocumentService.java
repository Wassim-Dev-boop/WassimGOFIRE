package com.cnstn.ged.service;

import com.cnstn.ged.client.notification.NotificationClient;
import com.cnstn.ged.dto.DocumentCreateRequest;
import com.cnstn.ged.dto.DocumentResponse;
import com.cnstn.ged.dto.PageResponse;
import com.cnstn.ged.entity.DocumentEntity;
import com.cnstn.ged.entity.DocumentStatus;
import com.cnstn.ged.exception.ResourceNotFoundException;
import com.cnstn.ged.mapper.DocumentMapper;
import com.cnstn.ged.repository.DocumentRepository;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final String ORGANISATION_CATEGORY = "Procedures et formulaires organisationnels";
    private static final String TECHNICAL_CATEGORY = "Procedures Techniques";
    private static final String DEFAULT_ORGANISATION_SUB_CATEGORY = "PQ1";
    private static final String DEFAULT_TECHNICAL_SUB_CATEGORY = "Labo1";

    private final DocumentRepository documentRepository;
    private final NotificationClient notificationClient;

    public DocumentService(DocumentRepository documentRepository, NotificationClient notificationClient) {
        this.documentRepository = documentRepository;
        this.notificationClient = notificationClient;
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> list(Pageable pageable) {
        Page<DocumentEntity> page = documentRepository.findAll(Objects.requireNonNull(pageable));
        return new PageResponse<>(
                page.map(DocumentMapper::toResponse).getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public DocumentResponse getById(UUID id) {
        return DocumentMapper.toResponse(fetchDocument(Objects.requireNonNull(id)));
    }

    @Transactional
    public DocumentResponse create(DocumentCreateRequest request, String createdBy) {
        String category = request.category().trim();
        DocumentEntity document = new DocumentEntity();
        document.setTitle(request.title().trim());
        document.setCategory(category);
        document.setSubCategory(resolveSubCategory(category, request.subCategory()));
        document.setContent(request.content().trim());
        document.setCreatedBy(createdBy);
        document.setStatus(DocumentStatus.DRAFT);

        DocumentEntity saved = documentRepository.save(document);
        notifyDocumentCreated(saved);
        return DocumentMapper.toResponse(saved);
    }

    @Transactional
    public DocumentResponse submitWorkflow(UUID id) {
        DocumentEntity document = fetchDocument(Objects.requireNonNull(id));
        document.setStatus(DocumentStatus.IN_REVIEW);
        DocumentEntity saved = documentRepository.save(document);
        notifyDocumentSubmitted(saved);
        return DocumentMapper.toResponse(saved);
    }

    @Transactional
    public DocumentResponse approve(UUID id, String approver) {
        DocumentEntity document = fetchDocument(Objects.requireNonNull(id));
        document.setStatus(DocumentStatus.APPROVED);
        document.setApprovedBy(approver);
        DocumentEntity saved = documentRepository.save(document);
        notifyDocumentApproved(saved, approver);
        return DocumentMapper.toResponse(saved);
    }

    @Transactional
    public DocumentResponse publish(UUID id, String approver) {
        DocumentEntity document = fetchDocument(Objects.requireNonNull(id));
        document.setStatus(DocumentStatus.PUBLISHED);
        document.setApprovedBy(approver);
        document.setPublishedAt(Instant.now());
        DocumentEntity saved = documentRepository.save(document);
        notifyDocumentPublished(saved, approver);
        return DocumentMapper.toResponse(saved);
    }

    private void notifyDocumentCreated(DocumentEntity document) {
        String creator = normalize(document.getCreatedBy());
        if (creator.isEmpty()) {
            return;
        }

        String safeTitle = normalize(document.getTitle());
        if (safeTitle.isEmpty()) {
            safeTitle = "document";
        }

        sendNotificationSafely(
                creator,
                "Document cree",
                "Votre document \"" + safeTitle + "\" a ete cree."
        );
    }

    private void notifyDocumentSubmitted(DocumentEntity document) {
        String creator = normalize(document.getCreatedBy());
        if (creator.isEmpty()) {
            return;
        }

        String safeTitle = normalize(document.getTitle());
        if (safeTitle.isEmpty()) {
            safeTitle = "document";
        }

        sendNotificationSafely(
                creator,
                "Document soumis pour approbation",
                "Votre document \"" + safeTitle + "\" est soumis pour approbation."
        );
    }

    private void notifyDocumentApproved(DocumentEntity document, String approver) {
        String creator = normalize(document.getCreatedBy());
        String safeApprover = normalize(approver);
        String safeTitle = normalize(document.getTitle());
        if (safeTitle.isEmpty()) {
            safeTitle = "document";
        }

        String creatorTitle = "Document approuve";
        String creatorMessage = "Votre document \"" + safeTitle + "\" a ete approuve.";
        if (!safeApprover.isEmpty()) {
            creatorMessage += " Decision prise par " + safeApprover + ".";
        }

        String approverTitle = "Approbation de document effectuee";
        String approverMessage = "Vous avez approuve le document \"" + safeTitle + "\".";
        if (!creator.isEmpty()) {
            approverMessage += " Createur: " + creator + ".";
        }

        sendNotificationSafely(creator, creatorTitle, creatorMessage);
        if (!safeApprover.equalsIgnoreCase(creator)) {
            sendNotificationSafely(safeApprover, approverTitle, approverMessage);
        }
    }

    private void notifyDocumentPublished(DocumentEntity document, String publisher) {
        String creator = normalize(document.getCreatedBy());
        String safePublisher = normalize(publisher);
        String safeTitle = normalize(document.getTitle());
        if (safeTitle.isEmpty()) {
            safeTitle = "document";
        }

        String creatorTitle = "Document publie";
        String creatorMessage = "Votre document \"" + safeTitle + "\" a ete publie.";
        if (!safePublisher.isEmpty()) {
            creatorMessage += " Publie par " + safePublisher + ".";
        }

        String publisherTitle = "Publication de document effectuee";
        String publisherMessage = "Vous avez publie le document \"" + safeTitle + "\".";
        if (!creator.isEmpty()) {
            publisherMessage += " Createur: " + creator + ".";
        }

        sendNotificationSafely(creator, creatorTitle, creatorMessage);
        if (!safePublisher.equalsIgnoreCase(creator)) {
            sendNotificationSafely(safePublisher, publisherTitle, publisherMessage);
        }
    }

    private void sendNotificationSafely(String recipientUsername, String title, String message) {
        String recipient = normalize(recipientUsername);
        if (recipient.isEmpty()) {
            return;
        }

        try {
            notificationClient.sendInternalNotification(recipient, title, message);
        } catch (Exception ex) {
            log.warn("Notification dispatch failed for recipient {}", recipient, ex);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String resolveSubCategory(String category, String requestedSubCategory) {
        String safeCategory = normalize(category);
        String safeSubCategory = normalize(requestedSubCategory);

        if (safeCategory.equalsIgnoreCase(ORGANISATION_CATEGORY)) {
            return normalizeOrganisationSubCategory(safeSubCategory);
        }

        if (safeCategory.equalsIgnoreCase(TECHNICAL_CATEGORY)) {
            return normalizeTechnicalSubCategory(safeSubCategory);
        }

        return safeSubCategory.isEmpty() ? "General" : safeSubCategory;
    }

    private String normalizeOrganisationSubCategory(String subCategory) {
        String safeSubCategory = normalize(subCategory);
        if (safeSubCategory.isEmpty()) {
            return DEFAULT_ORGANISATION_SUB_CATEGORY;
        }

        String compact = safeSubCategory.replaceAll("\\s+", "");
        if (compact.matches("(?i)^pq\\d+$")) {
            return "PQ" + compact.substring(2);
        }

        return safeSubCategory;
    }

    private String normalizeTechnicalSubCategory(String subCategory) {
        String safeSubCategory = normalize(subCategory);
        if (safeSubCategory.isEmpty()) {
            return DEFAULT_TECHNICAL_SUB_CATEGORY;
        }

        String compact = safeSubCategory.replaceAll("\\s+", "");
        if (compact.matches("(?i)^labo\\d+$")) {
            return "Labo" + compact.substring(4);
        }

        return safeSubCategory;
    }

    private DocumentEntity fetchDocument(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        return documentRepository.findById(safeId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + id));
    }
}
