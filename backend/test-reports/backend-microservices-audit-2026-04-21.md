# Backend Audit - CnstnPlat (2026-04-21)

## Scope executed in this pass
- Full code audit against the provided Product Backlog and checklist.
- Immediate fixes implemented on:
  - `auth-user-service`
  - `intervention-service`
- New automated tests added and executed with Maven.

## Changes implemented now

### 1) `auth-user-service`
- Added `POST /api/v1/auth/logout` (authenticated endpoint).
  - File: `auth-user-service/src/main/java/com/cnstn/authuser/controller/AuthRegistrationController.java`
  - File: `auth-user-service/src/main/java/com/cnstn/authuser/dto/LogoutRequest.java`
- Implemented Keycloak logout call (`/protocol/openid-connect/logout`) using `refresh_token`.
  - Idempotent behavior for already-invalid token (`invalid_grant`).
  - File: `auth-user-service/src/main/java/com/cnstn/authuser/service/AuthenticationService.java`
- Hardened login error mapping:
  - Invalid credentials -> `401 Unauthorized` (instead of `400`).
  - Disabled account detection -> `401` with explicit message.
  - Suspicious identifier payload (injection pattern) -> `400 Bad Request`.
- Extended login payload mapping:
  - `access_token` + `refresh_token` exposed in `LoginResponse`.
  - File: `auth-user-service/src/main/java/com/cnstn/authuser/dto/LoginResponse.java`
  - File: `auth-user-service/src/main/java/com/cnstn/authuser/client/keycloak/KeycloakTokenResponse.java`
- Added dedicated unauthorized exception handling in ProblemDetail layer.
  - File: `auth-user-service/src/main/java/com/cnstn/authuser/exception/UnauthorizedException.java`
  - File: `auth-user-service/src/main/java/com/cnstn/authuser/exception/GlobalExceptionHandler.java`

### 2) `intervention-service`
- Added missing employee self-service endpoints:
  - `PUT /api/v1/interventions/{id}` (update own request)
  - `DELETE /api/v1/interventions/{id}` (delete own request)
  - File: `intervention-service/src/main/java/com/cnstn/intervention/controller/InterventionController.java`
- Implemented ownership checks and business guards:
  - Only owner (or admin override) can update/delete.
  - Update/delete allowed only when status is `REQUESTED`.
  - Added status transition validation for manager updates.
  - Added validation constraints for approve flow.
  - File: `intervention-service/src/main/java/com/cnstn/intervention/service/InterventionService.java`
- Added DTO and domain exceptions:
  - `InterventionUpdateRequest`
  - `BadRequestException`
  - `ConflictException`
- Strengthened ProblemDetail handling:
  - Handles `400`, `403`, `404`, `409`, `422`, malformed payloads.
  - Explicit message for invalid enum status values.
  - File: `intervention-service/src/main/java/com/cnstn/intervention/exception/GlobalExceptionHandler.java`
- Tightened create request validation:
  - `description` now required and bounded (`@NotBlank`, `@Size(max=1000)`).
  - File: `intervention-service/src/main/java/com/cnstn/intervention/dto/InterventionCreateRequest.java`

## Tests added

### Unit tests
- `auth-user-service/src/test/java/com/cnstn/authuser/service/AuthenticationServiceTest.java`
  - login success
  - invalid credentials -> 401
  - injection-like identifier -> 400
  - logout idempotent invalid_grant
  - logout expired/unauthorized -> 401

- `intervention-service/src/test/java/com/cnstn/intervention/service/InterventionServiceTest.java`
  - own update success
  - forbidden update on another user's request
  - conflict when status not editable
  - own delete success
  - invalid status transition conflict
  - approve-before-completed conflict

### Web integration-style tests (MockMvc + security)
- `intervention-service/src/test/java/com/cnstn/intervention/controller/InterventionControllerTest.java`
  - employee update -> 200
  - employee delete -> 204
  - unauthorized role update -> 403

## Build and test result
- Command executed:
  - `mvn -pl auth-user-service,intervention-service clean test -DskipITs`
- Result:
  - `BUILD SUCCESS`
  - `auth-user-service`: tests passed
  - `intervention-service`: tests passed

## Gap summary still remaining (not yet implemented in this pass)
- `event-service`
  - Advanced overlap detection policies and stricter workflow constraints still partial.
  - External partner governance (DSN validation flow end-to-end) needs full implementation audit.
- `reservation-service`
  - Complete cancel flows and stricter refusal reason validation coverage still to complete.
- `ged-service`
  - Binary upload/download flow, MIME/size enforcement (`413/415`), and versioning entities still incomplete versus backlog US-31..33.
- `notification-service`
  - Internal API currently uses API key checks at service layer; full resilience/fallback pattern standardization still pending.
- Cross-services
  - Feign + fallbackFactory standardization is not uniform (several modules still use `RestTemplate` clients).
  - 422 validation semantics are not yet harmonized in every microservice.
  - Branch coverage target >80% is not yet globally achieved.

## Recommended next execution batch
1. `ged-service` US-31..33 full implementation (multipart upload, MIME/size guard, download stream, versioning).
2. `event-service` workflow hardening (department ownership validation + conflict queries + refusal reason constraints).
3. Global test campaign for all modules with consolidated coverage report.
