package com.cnstn.reservation.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public record ReservationCreateRequest(
        UUID roomId,
        UUID equipmentId,
        @NotNull @Future Instant startAt,
        @NotNull @Future Instant endAt,
        @Size(max = 500) String purpose
) {
}
