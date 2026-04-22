package com.cnstn.reporting.config;

import feign.RequestInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

@Configuration
public class FeignSecurityConfig {

    @Bean
    public RequestInterceptor bearerPropagationInterceptor() {
        return template -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication instanceof JwtAuthenticationToken jwtToken) {
                template.header("Authorization", "Bearer " + jwtToken.getToken().getTokenValue());
            }
        };
    }
}
