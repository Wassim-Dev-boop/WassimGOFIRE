package com.cnstn.reservation.service;

import com.cnstn.reservation.dto.PageResponse;
import com.cnstn.reservation.dto.RoomRequest;
import com.cnstn.reservation.dto.RoomResponse;
import com.cnstn.reservation.entity.RoomEntity;
import com.cnstn.reservation.exception.ResourceNotFoundException;
import com.cnstn.reservation.mapper.ReservationMapper;
import com.cnstn.reservation.repository.RoomRepository;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomService {

    private final RoomRepository roomRepository;

    public RoomService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<RoomResponse> list(Pageable pageable) {
        Page<RoomEntity> page = roomRepository.findAll(Objects.requireNonNull(pageable));
        return new PageResponse<>(
                page.map(ReservationMapper::toResponse).getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public RoomResponse getById(UUID id) {
        return ReservationMapper.toResponse(fetchRoom(Objects.requireNonNull(id)));
    }

    @Transactional
    public RoomResponse create(RoomRequest request) {
        RoomEntity room = new RoomEntity();
        room.setName(request.name().trim());
        room.setLocation(request.location().trim());
        room.setCapacity(request.capacity());
        room.setActive(request.active() == null || request.active());

        return ReservationMapper.toResponse(roomRepository.save(room));
    }

    @Transactional
    public RoomResponse update(UUID id, RoomRequest request) {
        RoomEntity room = fetchRoom(Objects.requireNonNull(id));
        room.setName(request.name().trim());
        room.setLocation(request.location().trim());
        room.setCapacity(request.capacity());
        if (request.active() != null) {
            room.setActive(request.active());
        }

        return ReservationMapper.toResponse(roomRepository.save(room));
    }

    @Transactional
    public void delete(UUID id) {
        RoomEntity room = Objects.requireNonNull(fetchRoom(Objects.requireNonNull(id)));
        roomRepository.delete(room);
    }

    @Transactional(readOnly = true)
    public RoomEntity fetchRoom(UUID id) {
        UUID safeId = Objects.requireNonNull(id);
        return roomRepository.findById(safeId)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + id));
    }
}
