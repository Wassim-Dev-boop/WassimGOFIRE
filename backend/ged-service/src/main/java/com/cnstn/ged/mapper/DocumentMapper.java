package com.cnstn.ged.mapper;

import com.cnstn.ged.dto.DocumentResponse;
import com.cnstn.ged.entity.DocumentEntity;

public final class DocumentMapper {

    private DocumentMapper() {
    }

    public static DocumentResponse toResponse(DocumentEntity entity) {
        return new DocumentResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getCategory(),
                entity.getSubCategory(),
                entity.getContent(),
                entity.getCreatedBy(),
                entity.getStatus(),
                entity.getApprovedBy(),
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
