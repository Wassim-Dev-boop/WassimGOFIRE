package com.cnstn.event.dto;

public record ZoomSignatureResponse(
        String sdkKey,
        String signature,
        String meetingNumber,
        String passcode,
        String userName,
        int role,
        String fallbackWebUrl,
        boolean sdkConfigured
) {
}
