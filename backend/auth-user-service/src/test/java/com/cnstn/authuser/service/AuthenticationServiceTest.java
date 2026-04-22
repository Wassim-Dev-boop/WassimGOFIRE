package com.cnstn.authuser.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cnstn.authuser.client.keycloak.KeycloakProperties;
import com.cnstn.authuser.client.keycloak.KeycloakTokenResponse;
import com.cnstn.authuser.dto.LoginRequest;
import com.cnstn.authuser.dto.LoginResponse;
import com.cnstn.authuser.exception.BadRequestException;
import com.cnstn.authuser.exception.UnauthorizedException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    @Mock
    private RestTemplate keycloakRestTemplate;

    private AuthenticationService authenticationService;

    @BeforeEach
    void setUp() {
        KeycloakProperties keycloakProperties = new KeycloakProperties();
        keycloakProperties.setRealm("cnstn-intranet");
        keycloakProperties.setLoginClientId("cnstn-postman");
        keycloakProperties.setLoginClientSecret("secret");
        authenticationService = new AuthenticationService(keycloakRestTemplate, keycloakProperties);
    }

    @Test
    @DisplayName("US-01.1 - login valide retourne access_token + refresh_token")
    void shouldLoginWhenCredentialsAreValid() {
        when(keycloakRestTemplate.exchange(
                eq("/realms/{realm}/protocol/openid-connect/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(KeycloakTokenResponse.class),
                eq("cnstn-intranet")
        )).thenReturn(ResponseEntity.ok(new KeycloakTokenResponse("access-token", "refresh-token")));

        LoginResponse response = authenticationService.login(new LoginRequest("employe.cnstn", "Password@123"));

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
    }

    @Test
    @DisplayName("US-01.2 - login invalide retourne 401")
    void shouldThrowUnauthorizedWhenCredentialsAreInvalid() {
        HttpClientErrorException unauthorized = HttpClientErrorException.create(
                HttpStatus.UNAUTHORIZED,
                "Unauthorized",
                HttpHeaders.EMPTY,
                "{\"error\":\"invalid_grant\"}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
        when(keycloakRestTemplate.exchange(
                eq("/realms/{realm}/protocol/openid-connect/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(KeycloakTokenResponse.class),
                eq("cnstn-intranet")
        )).thenThrow(unauthorized);

        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("employe.cnstn", "wrong")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("invalide");
    }

    @Test
    @DisplayName("US-01.7 - identifiant suspect rejete en 400")
    void shouldRejectSuspiciousIdentifier() {
        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("admin' OR '1'='1", "Password@123")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Identifiant invalide");
        verifyNoInteractions(keycloakRestTemplate);
    }

    @Test
    @DisplayName("US-02.3 - double logout idempotent (invalid_grant ignore)")
    void shouldIgnoreInvalidGrantOnLogout() {
        HttpClientErrorException badRequest = HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                HttpHeaders.EMPTY,
                "{\"error\":\"invalid_grant\"}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
        when(keycloakRestTemplate.exchange(
                eq("/realms/{realm}/protocol/openid-connect/logout"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Void.class),
                eq("cnstn-intranet")
        )).thenThrow(badRequest);

        assertThatCode(() -> authenticationService.logout("refresh-token"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("US-02.2 - logout avec token expire retourne 401")
    void shouldThrowUnauthorizedOnLogoutUnauthorized() {
        HttpClientErrorException unauthorized = HttpClientErrorException.create(
                HttpStatus.UNAUTHORIZED,
                "Unauthorized",
                HttpHeaders.EMPTY,
                "expired".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        );
        when(keycloakRestTemplate.exchange(
                eq("/realms/{realm}/protocol/openid-connect/logout"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Void.class),
                eq("cnstn-intranet")
        )).thenThrow(unauthorized);

        assertThatThrownBy(() -> authenticationService.logout("refresh-token"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Token expire");
    }
}
