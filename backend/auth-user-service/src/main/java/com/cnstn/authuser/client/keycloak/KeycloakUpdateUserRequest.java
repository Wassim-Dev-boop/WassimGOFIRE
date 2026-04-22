package com.cnstn.authuser.client.keycloak;

public record KeycloakUpdateUserRequest(
        String email,
        String firstName,
        String lastName,
        boolean enabled,
        String phone
) {
}
