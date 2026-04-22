package com.cnstn.event.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.cnstn.event.config.ZoomSdkProperties;
import com.cnstn.event.exception.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class ZoomSignatureServiceTest {

    @Test
    void shouldThrowWhenSdkConfigMissing() {
        ZoomSdkProperties properties = new ZoomSdkProperties();
        properties.setKey("");
        properties.setSecret("");

        ZoomSignatureService service = new ZoomSignatureService(properties, new ObjectMapper());

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> service.generateSignature("12345678901", 0)
        );
        assertEquals("Zoom SDK key/secret are not configured", exception.getMessage());
    }

    @Test
    void shouldGenerateJwtLikeSignatureWhenConfigPresent() {
        ZoomSdkProperties properties = new ZoomSdkProperties();
        properties.setKey("sdk-key-demo");
        properties.setSecret("sdk-secret-demo");

        ZoomSignatureService service = new ZoomSignatureService(properties, new ObjectMapper());

        String signature = service.generateSignature("12345678901", 0);
        assertNotNull(signature);
        assertFalse(signature.isBlank());

        String[] parts = signature.split("\\.");
        assertEquals(3, parts.length);
        assertTrue(parts[0].length() > 10);
        assertTrue(parts[1].length() > 10);
        assertTrue(parts[2].length() > 10);
    }
}
