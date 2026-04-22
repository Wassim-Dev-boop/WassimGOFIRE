package com.cnstn.event.service;

import com.cnstn.event.config.ZoomSdkProperties;
import com.cnstn.event.exception.BadRequestException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class ZoomSignatureService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private final ZoomSdkProperties zoomSdkProperties;
    private final ObjectMapper objectMapper;

    public ZoomSignatureService(ZoomSdkProperties zoomSdkProperties, ObjectMapper objectMapper) {
        this.zoomSdkProperties = zoomSdkProperties;
        this.objectMapper = objectMapper;
    }

    public String getSdkKey() {
        return normalize(zoomSdkProperties.getKey());
    }

    public String generateSignature(String meetingNumber, int role) {
        String sdkKey = getSdkKey();
        String sdkSecret = normalize(zoomSdkProperties.getSecret());
        String safeMeetingNumber = normalize(meetingNumber);

        if (sdkKey.isEmpty() || sdkSecret.isEmpty()) {
            throw new BadRequestException("Zoom SDK key/secret are not configured");
        }

        if (safeMeetingNumber.isEmpty()) {
            throw new BadRequestException("Zoom meeting number is missing");
        }

        long issuedAt = Instant.now().minusSeconds(30).getEpochSecond();
        long expiresAt = issuedAt + (2 * 60 * 60);

        String header = toBase64UrlJson(Map.of(
                "alg", "HS256",
                "typ", "JWT"
        ));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sdkKey", sdkKey);
        payload.put("mn", safeMeetingNumber);
        payload.put("role", role);
        payload.put("iat", issuedAt);
        payload.put("exp", expiresAt);
        payload.put("tokenExp", expiresAt);
        String payloadPart = toBase64UrlJson(payload);

        String signingInput = header + "." + payloadPart;
        String signature = sign(signingInput, sdkSecret);
        return signingInput + "." + signature;
    }

    private String toBase64UrlJson(Map<String, Object> payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(json.getBytes(StandardCharsets.UTF_8));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize Zoom SDK payload", ex);
        }
    }

    private String sign(String input, String secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] hash = mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to generate Zoom SDK signature", ex);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
