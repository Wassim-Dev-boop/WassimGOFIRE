package com.cnstn.intervention.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cnstn.intervention.dto.InterventionResponse;
import com.cnstn.intervention.dto.InterventionUpdateRequest;
import com.cnstn.intervention.entity.InterventionStatus;
import com.cnstn.intervention.security.JwtAuthConverter;
import com.cnstn.intervention.security.SecurityConfig;
import com.cnstn.intervention.service.InterventionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = InterventionController.class,
        properties = {
                "spring.cloud.config.enabled=false",
                "eureka.client.enabled=false"
        }
)
@AutoConfigureMockMvc
@Import(SecurityConfig.class)
class InterventionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private InterventionService interventionService;

    @MockBean
    private JwtAuthConverter jwtAuthConverter;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    @WithMockUser(username = "employe.cnstn", roles = {"EMPLOYE"})
    @DisplayName("US-17.1 - PUT /interventions/{id} retourne 200 pour employe proprietaire")
    void shouldReturn200WhenEmployeeUpdatesOwnIntervention() throws Exception {
        UUID id = UUID.randomUUID();
        InterventionUpdateRequest request = new InterventionUpdateRequest("Titre mis a jour", "Description mise a jour");

        when(interventionService.updateOwnRequest(eq(id), any(InterventionUpdateRequest.class), eq("employe.cnstn"), eq(false)))
                .thenReturn(buildResponse(id));

        mockMvc.perform(put("/api/v1/interventions/{id}", id)
                        .with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.status").value("REQUESTED"));

        verify(interventionService).updateOwnRequest(eq(id), any(InterventionUpdateRequest.class), eq("employe.cnstn"), eq(false));
    }

    @Test
    @WithMockUser(username = "employe.cnstn", roles = {"EMPLOYE"})
    @DisplayName("US-18.1 - DELETE /interventions/{id} retourne 204 pour employe proprietaire")
    void shouldReturn204WhenEmployeeDeletesOwnIntervention() throws Exception {
        UUID id = UUID.randomUUID();
        doNothing().when(interventionService).deleteOwnRequest(id, "employe.cnstn", false);

        mockMvc.perform(delete("/api/v1/interventions/{id}", id).with(csrf()))
                .andExpect(status().isNoContent());

        verify(interventionService).deleteOwnRequest(id, "employe.cnstn", false);
    }

    @Test
    @WithMockUser(username = "room.manager", roles = {"RESPONSABLE_SALLE"})
    @DisplayName("US-17.3 - PUT /interventions/{id} interdit pour role non autorise")
    void shouldReturn403ForUnauthorizedRoleOnUpdateOwnRequest() throws Exception {
        UUID id = UUID.randomUUID();
        InterventionUpdateRequest request = new InterventionUpdateRequest("Titre", "Description");

        mockMvc.perform(put("/api/v1/interventions/{id}", id)
                        .with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());

        verifyNoInteractions(interventionService);
    }

    private InterventionResponse buildResponse(UUID id) {
        return new InterventionResponse(
                id,
                "Titre mis a jour",
                "Description mise a jour",
                "employe.cnstn",
                null,
                InterventionStatus.REQUESTED,
                null,
                null,
                Instant.now(),
                Instant.now()
        );
    }
}
