package com.cnstn.event.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record EventCreateRequest(
        @NotBlank @Size(max = 150) String title,
        @Size(max = 2000) String description,
        @NotNull @Future Instant startAt,
        @NotNull @Future Instant endAt,
        @Size(max = 150) String location,
        Boolean onlineEvent,
        @Size(max = 30) String zoomMeetingNumber,
        @Size(max = 100) String zoomPasscode
) {
}
