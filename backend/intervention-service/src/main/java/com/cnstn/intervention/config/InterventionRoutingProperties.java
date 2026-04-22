package com.cnstn.intervention.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.intervention")
public class InterventionRoutingProperties {

    private List<String> roomManagerRecipients = new ArrayList<>();

    public List<String> getRoomManagerRecipients() {
        return roomManagerRecipients;
    }

    public void setRoomManagerRecipients(List<String> roomManagerRecipients) {
        this.roomManagerRecipients = roomManagerRecipients == null ? new ArrayList<>() : roomManagerRecipients;
    }
}
