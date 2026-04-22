package com.cnstn.reporting.client;

import com.cnstn.reporting.dto.GenericPageResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "event-service")
public interface EventClient {

    @GetMapping("/api/v1/events")
    GenericPageResponse count(@RequestParam("page") int page, @RequestParam("size") int size);
}
