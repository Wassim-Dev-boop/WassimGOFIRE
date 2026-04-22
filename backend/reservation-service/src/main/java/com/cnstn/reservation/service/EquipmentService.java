package com.cnstn.reservation.service;

import com.cnstn.reservation.dto.EquipmentRequest;
import com.cnstn.reservation.dto.EquipmentResponse;
import com.cnstn.reservation.dto.PageResponse;
import com.cnstn.reservation.entity.EquipmentEntity;
import com.cnstn.reservation.exception.ResourceNotFoundException;
import com.cnstn.reservation.mapper.ReservationMapper;
import com.cnstn.reservation.repository.EquipmentRepository;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EquipmentService {

    private final EquipmentRepository equipmentRepository;

    public EquipmentService(EquipmentRepository equipmentRepository) {
        this.equipmentRepository = equipmentRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<EquipmentResponse> list(Pageable pageable) {
        Page<EquipmentEntity> page = equipmentRepository.findAll(Objects.requireNonNull(pageable));
        return new PageResponse<>(
                page.map(ReservationMapper::toResponse).getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public EquipmentResponse getById(UUID id) {
        return ReservationMapper.toResponse(fetchEquipment(Objects.requireNonNull(id)));
    }

    @Transactional
    public EquipmentResponse create(EquipmentRequest request) {
        EquipmentEntity equipment = new EquipmentEntity();
        equipment.setName(request.name().trim());
        equipment.setSerialNumber(request.serialNumber().trim());
        equipment.setDescription(request.description());
        equipment.setActive(request.active() == null || request.active());

        return ReservationMapper.toResponse(equipmentRepository.save(equipment));
    }

    @Transactional
    public EquipmentResponse update(UUID id, EquipmentRequest request) {
        EquipmentEntity equipment = fetchEquipment(Objects.requireNonNull(id));
        equipment.setName(request.name().trim());
        equipment.setSerialNumber(request.serialNumber().trim());
        equipment.setDescription(request.description());
        if (request.active() != null) {
            equipment.setActive(request.active());
        }

        return ReservationMapper.toResponse(equipmentRepository.save(equipment));
    }

    @Transactional
    public void delete(UUID id) {
        EquipmentEntity equipment = Objects.requireNonNull(fetchEquipment(Objects.requireNonNull(id)));
        equipmentRepository.delete(equipment);
    }

    @Transactional(readOnly = true)
    public EquipmentEntity fetchEquipment(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        return equipmentRepository.findById(safeId)
                .orElseThrow(() -> new ResourceNotFoundException("Equipment not found: " + id));
    }
}
